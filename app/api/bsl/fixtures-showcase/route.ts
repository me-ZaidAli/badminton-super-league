import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslRubbers,
  bslClubs,
  bslTeams,
  bslTeamMembers,
  bslPlayers,
  users,
} from "@/lib/server/schema";
import { inArray, eq } from "drizzle-orm";
import { computeFixtureScore } from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const limit = Math.max(
      1,
      Math.min(12, Number(new URL(req.url).searchParams.get("limit")) || 6),
    );
    const all = await db.select().from(bslFixtures);
    const eligible = all.filter((f) =>
      ["LIVE", "WARMUP", "SCHEDULED"].includes(String(f.status || "")),
    );
    eligible.sort((a, b) => {
      const rank = (s: string) => (s === "LIVE" ? 0 : s === "WARMUP" ? 1 : 2);
      const ra = rank(String(a.status || "SCHEDULED"));
      const rb = rank(String(b.status || "SCHEDULED"));
      if (ra !== rb) return ra - rb;
      const ta = a.startTime
        ? new Date(a.startTime).getTime()
        : Number.MAX_SAFE_INTEGER;
      const tb = b.startTime
        ? new Date(b.startTime).getTime()
        : Number.MAX_SAFE_INTEGER;
      return ta - tb;
    });
    const picked = eligible.slice(0, limit);
    if (picked.length === 0) return Response.json([]);
    const fixtureIds = picked.map((f) => f.id);
    const clubIds = Array.from(
      new Set(
        picked
          .flatMap((f) => [f.homeClubId, f.awayClubId])
          .filter((x): x is number => x != null),
      ),
    );
    const [rubbers, clubs] = await Promise.all([
      db
        .select()
        .from(bslRubbers)
        .where(inArray(bslRubbers.bslFixtureId, fixtureIds))
        .orderBy(bslRubbers.rubberNumber),
      clubIds.length
        ? db.select().from(bslClubs).where(inArray(bslClubs.id, clubIds))
        : Promise.resolve([] as any[]),
    ]);
    const cMap = new Map(clubs.map((c) => [c.id, c]));
    const teamIds = Array.from(
      new Set(
        rubbers
          .flatMap((r) => [r.homeTeamId, r.awayTeamId])
          .filter((x): x is number => x != null),
      ),
    );
    const teams = teamIds.length
      ? await db.select().from(bslTeams).where(inArray(bslTeams.id, teamIds))
      : [];
    const tMap = new Map(teams.map((t) => [t.id, t]));
    const memberRows = teamIds.length
      ? await db
          .select()
          .from(bslTeamMembers)
          .where(inArray(bslTeamMembers.bslTeamId, teamIds))
      : [];
    const playerIds = Array.from(new Set(memberRows.map((m) => m.bslPlayerId)));
    const players = playerIds.length
      ? await db
          .select()
          .from(bslPlayers)
          .where(inArray(bslPlayers.id, playerIds))
      : [];
    const userIds = Array.from(
      new Set(
        players.map((p) => p.userId).filter((x): x is number => x != null),
      ),
    );
    const userRows = userIds.length
      ? await db
          .select({ id: users.id, name: users.fullName })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(userRows.map((u) => [u.id, u]));
    const playerMap = new Map(
      players.map((p) => [
        p.id,
        {
          id: p.id,
          name:
            p.displayName ||
            (p.userId != null ? userMap.get(p.userId)?.name : null) ||
            `Player #${p.id}`,
        },
      ]),
    );
    const teamWithMembers = (teamId: number | null) => {
      if (!teamId) return null;
      const t = tMap.get(teamId);
      if (!t) return null;
      return {
        id: t.id,
        name: t.name,
        category: t.category,
        members: memberRows
          .filter((m) => m.bslTeamId === t.id)
          .map((m) => playerMap.get(m.bslPlayerId))
          .filter(Boolean),
      };
    };
    const enriched = picked.map((f) => {
      const hc = f.homeClubId != null ? cMap.get(f.homeClubId) : null;
      const ac = f.awayClubId != null ? cMap.get(f.awayClubId) : null;
      const rawRubbers = rubbers.filter((r) => r.bslFixtureId === f.id);
      const fixtureRubbers = rawRubbers.map((r) => ({
        id: r.id,
        rubberNumber: r.rubberNumber,
        rubberType: r.rubberType,
        status: r.status,
        homeScore: r.homeScore,
        awayScore: r.awayScore,
        homePair: teamWithMembers(r.homeTeamId),
        awayPair: teamWithMembers(r.awayTeamId),
      }));
      return {
        id: f.id,
        status: f.status,
        startTime: f.startTime,
        court: f.court,
        category: f.category,
        division: f.category,
        homeRubbers: f.homeRubbers,
        awayRubbers: f.awayRubbers,
        ...computeFixtureScore(rawRubbers),
        homeClubId: f.homeClubId,
        awayClubId: f.awayClubId,
        homeClubName: hc?.name || "TBD",
        awayClubName: ac?.name || "TBD",
        homeClubLogo: hc?.logoUrl || null,
        awayClubLogo: ac?.logoUrl || null,
        rubbers: fixtureRubbers,
      };
    });
    return Response.json(enriched);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
