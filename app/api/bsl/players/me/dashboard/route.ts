import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslPlayers,
  bslClubs,
  bslTeams,
  bslTeamMembers,
  bslWalletTransactions,
  bslLeagues,
  bslFixtures,
  bslRubbers,
  users,
} from "@/lib/server/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import {
  ALLOWED_CATS,
  computePlayerLeaderboard,
} from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (!me)
      return Response.json({
        player: null,
        club: null,
        league: null,
        categories: [],
        nextMatch: null,
        upcoming: [],
        history: [],
        walletTx: [],
      });

    const [club, league] = await Promise.all([
      me.bslClubId
        ? db
            .select()
            .from(bslClubs)
            .where(eq(bslClubs.id, me.bslClubId))
            .limit(1)
            .then((r) => r[0] ?? null)
        : Promise.resolve(null),
      db
        .select()
        .from(bslLeagues)
        .where(eq(bslLeagues.id, 1))
        .limit(1)
        .then((r) => r[0] ?? null),
    ]);

    // ── My pairs (team + partners per category) ─────────────────────────────
    const myMemberships = await db
      .select()
      .from(bslTeamMembers)
      .where(eq(bslTeamMembers.bslPlayerId, me.id));
    const myTeamIds = myMemberships.map((m) => m.bslTeamId);
    const myTeams = myTeamIds.length
      ? await db.select().from(bslTeams).where(inArray(bslTeams.id, myTeamIds))
      : [];
    const partnerMemberships = myTeamIds.length
      ? await db
          .select()
          .from(bslTeamMembers)
          .where(inArray(bslTeamMembers.bslTeamId, myTeamIds))
      : [];
    const partnerPlayerIds = Array.from(
      new Set(
        partnerMemberships
          .map((m) => m.bslPlayerId)
          .filter((id) => id !== me.id),
      ),
    );
    const partnerPlayers = partnerPlayerIds.length
      ? await db
          .select()
          .from(bslPlayers)
          .where(inArray(bslPlayers.id, partnerPlayerIds))
      : [];
    const partnerUserIds = Array.from(
      new Set(partnerPlayers.map((p) => p.userId)),
    );
    const partnerUserRows = partnerUserIds.length
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
            profilePictureUrl: users.profilePictureUrl,
          })
          .from(users)
          .where(inArray(users.id, partnerUserIds))
      : [];
    const partnerUserMap = new Map(partnerUserRows.map((u) => [u.id, u]));
    const partnerPlayerMap = new Map(partnerPlayers.map((p) => [p.id, p]));

    const categories = ALLOWED_CATS.map((cat) => {
      const team = myTeams.find((t) => t.category === cat) || null;
      const partners = team
        ? partnerMemberships
            .filter((m) => m.bslTeamId === team.id && m.bslPlayerId !== me.id)
            .map((m) => {
              const p = partnerPlayerMap.get(m.bslPlayerId);
              const u = p ? partnerUserMap.get(p.userId) : undefined;
              return {
                playerId: m.bslPlayerId,
                displayName: p?.displayName || u?.fullName || "Player",
                avatarUrl: u?.profilePictureUrl || null,
              };
            })
        : [];
      return { category: cat, team, partners };
    });

    // ── Fixtures I'm playing in (via rubbers I'm named on) ──────────────────
    const myRubbers = await db
      .select()
      .from(bslRubbers)
      .where(
        or(
          eq(bslRubbers.homePlayer1Id, me.id),
          eq(bslRubbers.homePlayer2Id, me.id),
          eq(bslRubbers.awayPlayer1Id, me.id),
          eq(bslRubbers.awayPlayer2Id, me.id),
        ),
      );
    const fixtureIds = Array.from(
      new Set(myRubbers.map((r) => r.bslFixtureId)),
    );
    const myFixtures = fixtureIds.length
      ? await db.select().from(bslFixtures).where(inArray(bslFixtures.id, fixtureIds))
      : [];
    const rubbersByFixture = new Map<number, typeof myRubbers>();
    for (const r of myRubbers) {
      const list = rubbersByFixture.get(r.bslFixtureId) || [];
      list.push(r);
      rubbersByFixture.set(r.bslFixtureId, list);
    }
    const sideTeamIds = new Set<number>();
    const sideClubIds = new Set<number>();
    for (const f of myFixtures) {
      if (f.homeClubId != null) sideClubIds.add(f.homeClubId);
      if (f.awayClubId != null) sideClubIds.add(f.awayClubId);
      if (f.homeTeamId != null) sideTeamIds.add(f.homeTeamId);
      if (f.awayTeamId != null) sideTeamIds.add(f.awayTeamId);
    }
    for (const r of myRubbers) {
      if (r.homeTeamId != null) sideTeamIds.add(r.homeTeamId);
      if (r.awayTeamId != null) sideTeamIds.add(r.awayTeamId);
    }
    const sideTeams = sideTeamIds.size
      ? await db
          .select()
          .from(bslTeams)
          .where(inArray(bslTeams.id, Array.from(sideTeamIds)))
      : [];
    for (const t of sideTeams) if (t.bslClubId != null) sideClubIds.add(t.bslClubId);
    const sideClubs = sideClubIds.size
      ? await db
          .select()
          .from(bslClubs)
          .where(inArray(bslClubs.id, Array.from(sideClubIds)))
      : [];
    const teamMap = new Map(sideTeams.map((t) => [t.id, t]));
    const clubMap = new Map(sideClubs.map((c) => [c.id, c]));

    const clubForTeam = (teamId: number | null | undefined) =>
      teamId != null ? clubMap.get(teamMap.get(teamId)?.bslClubId ?? -1) : null;

    const matches = myFixtures.map((f) => {
      const rubbers = rubbersByFixture.get(f.id) || [];
      // Which side am I on? Look at the first rubber I'm named on.
      const mine = rubbers[0];
      const onHome =
        mine?.homePlayer1Id === me.id || mine?.homePlayer2Id === me.id;
      const homeClub = f.homeClubId != null
        ? clubMap.get(f.homeClubId)
        : clubForTeam(f.homeTeamId ?? mine?.homeTeamId);
      const awayClub = f.awayClubId != null
        ? clubMap.get(f.awayClubId)
        : clubForTeam(f.awayTeamId ?? mine?.awayTeamId);
      const usClub = onHome ? homeClub : awayClub;
      const themClub = onHome ? awayClub : homeClub;
      const usRubbers = onHome ? f.homeRubbers : f.awayRubbers;
      const themRubbers = onHome ? f.awayRubbers : f.homeRubbers;
      const outcome =
        f.status !== "FINISHED"
          ? null
          : usRubbers > themRubbers
            ? "WIN"
            : usRubbers < themRubbers
              ? "LOSS"
              : "DRAW";
      return {
        id: f.id,
        startTime: f.startTime,
        court: f.court,
        status: f.status,
        outcome,
        us: {
          name: usClub?.name || "Us",
          logoUrl: usClub?.logoUrl || null,
          rubbers: usRubbers,
        },
        them: {
          name: themClub?.name || "TBC",
          logoUrl: themClub?.logoUrl || null,
          rubbers: themRubbers,
        },
      };
    });
    matches.sort((a, b) => {
      const at = a.startTime ? new Date(a.startTime).getTime() : 0;
      const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
      return at - bt;
    });
    const history = matches
      .filter((m) => m.status === "FINISHED")
      .sort((a, b) => {
        const at = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bt = b.startTime ? new Date(b.startTime).getTime() : 0;
        return bt - at;
      });
    const upcoming = matches.filter((m) => m.status !== "FINISHED");
    const nextMatch = upcoming[0] || null;

    const lb = await computePlayerLeaderboard();
    const myLb = lb.find((r) => r.playerId === me.id) || null;
    const txRows = await db
      .select()
      .from(bslWalletTransactions)
      .where(eq(bslWalletTransactions.bslPlayerId, me.id));

    return Response.json({
      player: me,
      club,
      league,
      categories,
      nextMatch,
      upcoming,
      history,
      leaderboard: myLb,
      walletTx: txRows,
    });
  } catch (err: any) {
    console.error("[players/me/dashboard GET]", err);
    return Response.json(
      { message: "Failed to load profile" },
      { status: 500 },
    );
  }
}

