import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslTeams,
  bslClubs,
  bslFixtures,
  bslRubbers,
} from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { rubberRallyPoints } from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const division = new URL(req.url).searchParams.get("division") ?? undefined;
    const teams = await db.select().from(bslTeams);
    const clubs = await db.select().from(bslClubs);
    const fixtures = await db.select().from(bslFixtures);
    const finished = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.status, "FINISHED" as any));
    const clubMap = new Map(clubs.map((c) => [c.id, c]));
    const tMap = new Map(teams.map((t) => [t.id, t]));
    const fMap = new Map(fixtures.map((f) => [f.id, f]));
    type Row = {
      id: number;
      name: string;
      clubName: string;
      clubLogo: string | null;
      division: string;
      played: number;
      won: number;
      lost: number;
      rubbersFor: number;
      rubbersAgainst: number;
      points: number;
      pointsAgainst: number;
      rubberDiff: number;
      categories: string[];
    };
    const byClub = new Map<number, Row>();
    const inScope = new Set<number>();
    if (division) {
      for (const c of clubs) {
        if (c.division === division) inScope.add(c.id);
        if ((c.additionalDivisions ?? []).includes(division)) inScope.add(c.id);
      }
      for (const t of teams) {
        if (t.division === division) inScope.add(t.bslClubId);
      }
    }
    const ensure = (clubId: number): Row | null => {
      const club = clubMap.get(clubId);
      if (!club) return null;
      if (division && !inScope.has(clubId)) return null;
      let row = byClub.get(clubId);
      if (!row) {
        row = {
          id: clubId,
          name: club.name,
          clubName: club.name,
          clubLogo: club.logoUrl || null,
          division: club.division || "—",
          played: 0,
          won: 0,
          lost: 0,
          rubbersFor: 0,
          rubbersAgainst: 0,
          points: 0,
          pointsAgainst: 0,
          rubberDiff: 0,
          categories: [],
        };
        byClub.set(clubId, row);
      }
      return row;
    };
    for (const t of teams) {
      const row = ensure(t.bslClubId);
      if (!row) continue;
      if (t.category && !row.categories.includes(t.category))
        row.categories.push(t.category);
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
        const row = ensure(homeClubId);
        if (row) {
          row.played++;
          row.rubbersFor += rp.homeSetsWon;
          row.rubbersAgainst += rp.awaySetsWon;
          row.points += rp.home;
          row.pointsAgainst += rp.away;
          if (homeWon) row.won++;
          else if (awayWon) row.lost++;
        }
      }
      if (awayClubId != null) {
        const row = ensure(awayClubId);
        if (row) {
          row.played++;
          row.rubbersFor += rp.awaySetsWon;
          row.rubbersAgainst += rp.homeSetsWon;
          row.points += rp.away;
          row.pointsAgainst += rp.home;
          if (awayWon) row.won++;
          else if (homeWon) row.lost++;
        }
      }
    }
    const enriched = Array.from(byClub.values()).map((r) => ({
      ...r,
      rubberDiff: r.points - r.pointsAgainst,
    }));
    enriched.sort(
      (a, b) =>
        b.points - a.points ||
        b.rubberDiff - a.rubberDiff ||
        b.played - a.played ||
        a.name.localeCompare(b.name),
    );
    return Response.json(enriched.map((r, i) => ({ ...r, position: i + 1 })));
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
