import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslTeams,
  bslFixtures,
  bslRubbers,
} from "@/lib/server/schema";
import { inArray } from "drizzle-orm";
import {
  rubberRallyPoints,
  loadResolvedPlayers,
} from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const sp = new URL(req.url).searchParams;
    const a = Number(sp.get("clubA"));
    const b = Number(sp.get("clubB"));
    if (!a || !b || a === b)
      return Response.json(
        { message: "clubA and clubB required and must differ" },
        { status: 400 },
      );
    const clubs = await db.select().from(bslClubs);
    const cMap = new Map(clubs.map((c) => [c.id, c]));
    const ca = cMap.get(a);
    const cb = cMap.get(b);
    if (!ca || !cb)
      return Response.json({ message: "Club not found" }, { status: 404 });
    const teams = await db.select().from(bslTeams);
    const tMap = new Map(teams.map((t) => [t.id, t]));
    const players = await loadResolvedPlayers();
    const pMap = new Map(players.map((p) => [p.id, p]));
    const nameOf = (pid: number | null) =>
      pid != null ? (pMap.get(pid)?.resolvedName ?? `Player #${pid}`) : "";
    const allFixtures = await db.select().from(bslFixtures);
    const fixtureClub = (
      clubId: number | null | undefined,
      teamId: number | null | undefined,
    ): number | null => {
      if (clubId != null) return clubId;
      if (teamId != null) return tMap.get(teamId)?.bslClubId ?? null;
      return null;
    };
    const between = allFixtures.filter((f) => {
      if (f.status !== "FINISHED") return false;
      const hc = fixtureClub(f.homeClubId, f.homeTeamId);
      const ac = fixtureClub(f.awayClubId, f.awayTeamId);
      return (hc === a && ac === b) || (hc === b && ac === a);
    });
    const fixtureIds = between.map((f) => f.id);
    const rubbers = fixtureIds.length
      ? await db
          .select()
          .from(bslRubbers)
          .where(inArray(bslRubbers.bslFixtureId, fixtureIds))
      : [];
    const rubbersByFixture = new Map<number, any[]>();
    for (const rb of rubbers) {
      const arr = rubbersByFixture.get(rb.bslFixtureId) || [];
      arr.push(rb);
      rubbersByFixture.set(rb.bslFixtureId, arr);
    }
    const summary = {
      fixtures: 0,
      aWins: 0,
      bWins: 0,
      draws: 0,
      aSets: 0,
      bSets: 0,
      aPoints: 0,
      bPoints: 0,
    };
    const fixturesOut = between
      .sort(
        (x, y) =>
          new Date(y.startTime || 0).getTime() -
          new Date(x.startTime || 0).getTime(),
      )
      .map((f) => {
        const aIsHome = fixtureClub(f.homeClubId, f.homeTeamId) === a;
        const rbs = (rubbersByFixture.get(f.id) || []).filter(
          (r) => r.status === "FINISHED",
        );
        let aPoints = 0,
          bPoints = 0,
          aSets = 0,
          bSets = 0;
        const rubberOut = rbs
          .sort((m, n) => (m.rubberNumber || 0) - (n.rubberNumber || 0))
          .map((r) => {
            const rp = rubberRallyPoints(r);
            const home = {
              points: rp.home,
              sets: rp.homeSetsWon,
              players: [r.homePlayer1Id, r.homePlayer2Id]
                .filter((x): x is number => x != null)
                .map(nameOf),
            };
            const away = {
              points: rp.away,
              sets: rp.awaySetsWon,
              players: [r.awayPlayer1Id, r.awayPlayer2Id]
                .filter((x): x is number => x != null)
                .map(nameOf),
            };
            const aSide = aIsHome ? home : away;
            const bSide = aIsHome ? away : home;
            aPoints += aSide.points;
            bPoints += bSide.points;
            aSets += aSide.sets;
            bSets += bSide.sets;
            const rawSets =
              Array.isArray(r.setScores) && r.setScores.length
                ? r.setScores.map((s: any) => ({
                    h: Number(s?.h) || 0,
                    a: Number(s?.a) || 0,
                  }))
                : (r.homeScore || 0) > 0 || (r.awayScore || 0) > 0
                  ? [{ h: r.homeScore || 0, a: r.awayScore || 0 }]
                  : [];
            return {
              type: r.rubberType || "—",
              aPlayers: aSide.players,
              bPlayers: bSide.players,
              aPoints: aSide.points,
              bPoints: bSide.points,
              aSets: aSide.sets,
              bSets: bSide.sets,
              sets: aIsHome
                ? rawSets.map((s) => ({ a: s.h, b: s.a }))
                : rawSets.map((s) => ({ a: s.a, b: s.h })),
            };
          });
        summary.fixtures++;
        summary.aPoints += aPoints;
        summary.bPoints += bPoints;
        summary.aSets += aSets;
        summary.bSets += bSets;
        if (aPoints > bPoints) summary.aWins++;
        else if (bPoints > aPoints) summary.bWins++;
        else summary.draws++;
        return {
          fixtureId: f.id,
          date: f.startTime ? new Date(f.startTime as any).toISOString() : null,
          aPoints,
          bPoints,
          aSets,
          bSets,
          result: aPoints > bPoints ? "A" : bPoints > aPoints ? "B" : "DRAW",
          rubbers: rubberOut,
        };
      });
    return Response.json({
      clubA: { id: a, name: ca.name, logo: ca.logoUrl || null },
      clubB: { id: b, name: cb.name, logo: cb.logoUrl || null },
      summary,
      fixtures: fixturesOut,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
