import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslTeams,
  bslTeamMembers,
  bslPlayers,
  users,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import { getSessionUser, unauthorised, isAdmin } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const sp = new URL(req.url).searchParams;
    const division = sp.get("division") || "";
    const allClubs = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.status, "ACTIVE"));
    const clubs = division
      ? allClubs.filter(
          (c) =>
            c.division === division ||
            (Array.isArray(c.additionalDivisions) &&
              c.additionalDivisions.includes(division)),
        )
      : allClubs;

    // Pull every team + roster member for these clubs so the response can
    // include the `teams`/standings fields the client actually renders —
    // the bare bslClubs row doesn't carry any of that.
    const clubIds = clubs.map((c) => c.id);
    const teams = clubIds.length
      ? await db.select().from(bslTeams).where(inArray(bslTeams.bslClubId, clubIds))
      : [];
    const teamIds = teams.map((t) => t.id);
    const teamMembers = teamIds.length
      ? await db
          .select()
          .from(bslTeamMembers)
          .where(inArray(bslTeamMembers.bslTeamId, teamIds))
      : [];
    const memberPlayerIds = Array.from(
      new Set(teamMembers.map((m) => m.bslPlayerId)),
    );
    const memberPlayers = memberPlayerIds.length
      ? await db
          .select()
          .from(bslPlayers)
          .where(inArray(bslPlayers.id, memberPlayerIds))
      : [];
    const playerMap = new Map(memberPlayers.map((p) => [p.id, p]));
    const playerUserIds = Array.from(
      new Set(memberPlayers.map((p) => p.userId)),
    );
    const userRows = playerUserIds.length
      ? await db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(inArray(users.id, playerUserIds))
      : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));

    // The current user's own player rows — drives `iAmMember`/`canActFor`.
    const myPlayers = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id));
    const myPlayerIds = new Set(myPlayers.map((p) => p.id));
    const myClubIds = new Set(
      myPlayers
        .filter((p) => p.bslClubId != null)
        .map((p) => p.bslClubId as number),
    );

    const teamsByClub = new Map<number, typeof teams>();
    for (const t of teams) {
      const list = teamsByClub.get(t.bslClubId) || [];
      list.push(t);
      teamsByClub.set(t.bslClubId, list);
    }

    const platformAdmin = isAdmin(user);
    const rows = clubs.map((c) => {
      const clubTeams = teamsByClub.get(c.id) || [];
      const played = clubTeams.reduce((s, t) => s + (t.played || 0), 0);
      const won = clubTeams.reduce((s, t) => s + (t.won || 0), 0);
      const lost = clubTeams.reduce((s, t) => s + (t.lost || 0), 0);
      const drawn = clubTeams.reduce((s, t) => s + (t.drawn || 0), 0);
      const points = clubTeams.reduce((s, t) => s + (t.points || 0), 0);
      const rubberDiff = clubTeams.reduce(
        (s, t) => s + ((t.rubbersFor || 0) - (t.rubbersAgainst || 0)),
        0,
      );
      const isManager = c.managerUserId === user.id;
      const isClubAdmin =
        Array.isArray(c.adminUserIds) && c.adminUserIds.includes(user.id);
      const isCaptain = clubTeams.some(
        (t) => t.captainPlayerId != null && myPlayerIds.has(t.captainPlayerId),
      );
      return {
        ...c,
        rank: null as number | null,
        played,
        won,
        lost,
        drawn,
        points,
        rubberDiff,
        iAmMember: isManager || isClubAdmin || myClubIds.has(c.id),
        canActFor: platformAdmin || isManager || isClubAdmin || isCaptain,
        teams: clubTeams.map((t) => ({
          id: t.id,
          name: t.name,
          division: t.division,
          category: t.category,
          pairNumber: t.pairNumber,
          members: teamMembers
            .filter((m) => m.bslTeamId === t.id)
            .map((m) => {
              const p = playerMap.get(m.bslPlayerId);
              const uName = p ? userMap.get(p.userId)?.fullName : undefined;
              return {
                playerId: m.bslPlayerId,
                name: p?.displayName || uName || `Player #${m.bslPlayerId}`,
              };
            }),
        })),
      };
    });

    rows.sort(
      (a, b) =>
        b.points - a.points ||
        b.rubberDiff - a.rubberDiff ||
        b.played - a.played ||
        a.name.localeCompare(b.name),
    );
    rows.forEach((r, i) => {
      r.rank = r.played > 0 ? i + 1 : null;
    });

    return Response.json(rows);
  } catch (err: any) {
    console.error("[challenge-zone/clubs GET]", err);
    return Response.json({ message: "Failed to load clubs" }, { status: 500 });
  }
}

