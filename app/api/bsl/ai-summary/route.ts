import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslTeams,
  bslFixtures,
  bslRubbers,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import { getBslSummary } from "@/lib/server/bsl-summary";
import {
  rubberRallyPoints,
  computeFixtureScore,
  loadResolvedPlayers,
} from "@/lib/server/bsl-helpers";

export async function GET(_req: NextRequest) {
  try {
    const summary = await getBslSummary(async () => {
      const clubs = await db.select().from(bslClubs);
      const teams = await db.select().from(bslTeams);
      const fixtures = await db.select().from(bslFixtures);
      const finished = await db
        .select()
        .from(bslRubbers)
        .where(eq(bslRubbers.status, "FINISHED" as any));
      const players = await loadResolvedPlayers();
      const tMap = new Map(teams.map((t) => [t.id, t]));
      const cMap = new Map(clubs.map((c) => [c.id, c]));
      const fMap = new Map(fixtures.map((f) => [f.id, f]));
      const pMap = new Map(players.map((p) => [p.id, p]));
      const sideClub = (
        teamId: number | null,
        fixtureClubId: number | null | undefined,
      ): number | null => {
        if (teamId != null) {
          const t = tMap.get(teamId);
          if (t) return t.bslClubId;
        }
        return fixtureClubId ?? null;
      };
      const clubAgg = new Map<
        number,
        {
          name: string;
          points: number;
          played: number;
          won: number;
          lost: number;
        }
      >();
      const ensureClub = (id: number) => {
        const c = cMap.get(id);
        if (!c) return null;
        let r = clubAgg.get(id);
        if (!r) {
          r = { name: c.name, points: 0, played: 0, won: 0, lost: 0 };
          clubAgg.set(id, r);
        }
        return r;
      };
      const playerAgg = new Map<
        number,
        { name: string; club: string; points: number }
      >();
      const ensurePlayer = (pid: number) => {
        const p = pMap.get(pid);
        if (!p) return null;
        let r = playerAgg.get(pid);
        if (!r) {
          const club = p.bslClubId != null ? cMap.get(p.bslClubId) : null;
          r = { name: p.resolvedName, club: club?.name || "—", points: 0 };
          playerAgg.set(pid, r);
        }
        return r;
      };
      for (const rb of finished) {
        const rp = rubberRallyPoints(rb);
        const homeWon = rp.homeSetsWon > rp.awaySetsWon;
        const awayWon = rp.awaySetsWon > rp.homeSetsWon;
        const fx = fMap.get(rb.bslFixtureId);
        const hc = sideClub(rb.homeTeamId ?? null, fx?.homeClubId);
        const ac = sideClub(rb.awayTeamId ?? null, fx?.awayClubId);
        if (hc != null) {
          const r = ensureClub(hc);
          if (r) {
            r.played++;
            r.points += rp.home;
            if (homeWon) r.won++;
            else if (awayWon) r.lost++;
          }
        }
        if (ac != null) {
          const r = ensureClub(ac);
          if (r) {
            r.played++;
            r.points += rp.away;
            if (awayWon) r.won++;
            else if (homeWon) r.lost++;
          }
        }
        for (const pid of [rb.homePlayer1Id, rb.homePlayer2Id].filter(
          (x): x is number => x != null,
        )) {
          const r = ensurePlayer(pid);
          if (r) r.points += rp.home;
        }
        for (const pid of [rb.awayPlayer1Id, rb.awayPlayer2Id].filter(
          (x): x is number => x != null,
        )) {
          const r = ensurePlayer(pid);
          if (r) r.points += rp.away;
        }
      }
      const standings = Array.from(clubAgg.values())
        .sort((a, b) => b.points - a.points || b.played - a.played)
        .slice(0, 8);
      const topPlayers = Array.from(playerAgg.values())
        .sort((a, b) => b.points - a.points)
        .slice(0, 5);
      const rubbersByFixture = new Map<number, any[]>();
      for (const rb of finished) {
        const arr = rubbersByFixture.get(rb.bslFixtureId) || [];
        arr.push(rb);
        rubbersByFixture.set(rb.bslFixtureId, arr);
      }
      const clubNameForFixtureSide = (
        clubId: number | null | undefined,
        teamId: number | null | undefined,
      ): string => {
        const cid =
          clubId ?? (teamId != null ? tMap.get(teamId)?.bslClubId : null);
        return cid != null ? cMap.get(cid)?.name || "TBD" : "TBD";
      };
      const recentResults = fixtures
        .filter((f) => f.status === "FINISHED")
        .sort(
          (a, b) =>
            new Date(b.startTime || 0).getTime() -
            new Date(a.startTime || 0).getTime(),
        )
        .slice(0, 6)
        .map((f) => {
          const sc = computeFixtureScore(rubbersByFixture.get(f.id) || []);
          return {
            home: clubNameForFixtureSide(f.homeClubId, f.homeTeamId),
            away: clubNameForFixtureSide(f.awayClubId, f.awayTeamId),
            homePoints: sc.homePoints,
            awayPoints: sc.awayPoints,
            homeSets: sc.homeSets,
            awaySets: sc.awaySets,
          };
        });
      return {
        standings,
        recentResults,
        topPlayers,
        totalFinished: finished.length,
      };
    });
    return Response.json(summary);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
