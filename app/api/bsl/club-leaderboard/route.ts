import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslTeams,
  bslFixtures,
  bslRubbers,
} from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  rubberRallyPoints,
  loadResolvedPlayers,
} from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const division = new URL(req.url).searchParams.get("division") ?? undefined;
    const clubs = await db.select().from(bslClubs);
    const teams = await db.select().from(bslTeams);
    const fixtures = await db.select().from(bslFixtures);
    const players = await loadResolvedPlayers();
    const finished = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.status, "FINISHED" as any));
    const tMap = new Map(teams.map((t) => [t.id, t]));
    const fMap = new Map(fixtures.map((f) => [f.id, f]));
    type Row = {
      clubId: number;
      clubName: string;
      clubLogo: string | null;
      division: string;
      played: number;
      won: number;
      lost: number;
      setsFor: number;
      setsAgainst: number;
      points: number;
      pointsAgainst: number;
      winRate: number;
      playerCount: number;
    };
    const byClub = new Map<number, Row>();
    for (const c of clubs) {
      byClub.set(c.id, {
        clubId: c.id,
        clubName: c.name,
        clubLogo: c.logoUrl || null,
        division: (c.division as string) || "—",
        played: 0,
        won: 0,
        lost: 0,
        setsFor: 0,
        setsAgainst: 0,
        points: 0,
        pointsAgainst: 0,
        winRate: 0,
        playerCount: 0,
      });
    }
    for (const p of players) {
      if (p.bslClubId != null) {
        const row = byClub.get(p.bslClubId);
        if (row) row.playerCount++;
      }
    }
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
    for (const r of finished) {
      const rp = rubberRallyPoints(r);
      const homeWon = rp.homeSetsWon > rp.awaySetsWon;
      const awayWon = rp.awaySetsWon > rp.homeSetsWon;
      const fx = fMap.get(r.bslFixtureId);
      const homeClubId = sideClub(r.homeTeamId ?? null, fx?.homeClubId);
      const awayClubId = sideClub(r.awayTeamId ?? null, fx?.awayClubId);
      if (homeClubId != null) {
        const row = byClub.get(homeClubId);
        if (row) {
          row.played++;
          row.setsFor += rp.homeSetsWon;
          row.setsAgainst += rp.awaySetsWon;
          row.points += rp.home;
          row.pointsAgainst += rp.away;
          if (homeWon) row.won++;
          else if (awayWon) row.lost++;
        }
      }
      if (awayClubId != null) {
        const row = byClub.get(awayClubId);
        if (row) {
          row.played++;
          row.setsFor += rp.awaySetsWon;
          row.setsAgainst += rp.homeSetsWon;
          row.points += rp.away;
          row.pointsAgainst += rp.home;
          if (awayWon) row.won++;
          else if (homeWon) row.lost++;
        }
      }
    }
    let rows = Array.from(byClub.values()).map((r) => ({
      ...r,
      winRate: r.played > 0 ? Math.round((r.won / r.played) * 100) : 0,
    }));
    if (division) rows = rows.filter((r) => r.division === division);
    rows.sort(
      (a, b) =>
        b.points - a.points ||
        b.points - b.pointsAgainst - (a.points - a.pointsAgainst) ||
        b.played - a.played ||
        a.clubName.localeCompare(b.clubName),
    );
    return Response.json(rows.map((r, i) => ({ ...r, position: i + 1 })));
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
