import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs, bslRubbers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  rubberRallyPoints,
  loadResolvedPlayers,
} from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const division = new URL(req.url).searchParams.get("division") ?? undefined;
    const finished = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.status, "FINISHED" as any));
    const players = await loadResolvedPlayers();
    const clubs = await db.select().from(bslClubs);
    const pMap = new Map(players.map((p) => [p.id, p]));
    const cMap = new Map(clubs.map((c) => [c.id, c]));
    type Row = {
      pairKey: string;
      player1Id: number;
      player1Name: string;
      player2Id: number;
      player2Name: string;
      clubId: number | null;
      clubName: string;
      clubLogo: string | null;
      division: string;
      matchesPlayed: number;
      won: number;
      lost: number;
      setsFor: number;
      setsAgainst: number;
      winRate: number;
      points: number;
    };
    const byPair = new Map<string, Row>();
    const ensure = (a: number, b: number): Row | null => {
      const [lo, hi] = a < b ? [a, b] : [b, a];
      const key = `${lo}-${hi}`;
      let row = byPair.get(key);
      if (!row) {
        const p1 = pMap.get(lo),
          p2 = pMap.get(hi);
        if (!p1 || !p2) return null;
        const clubId = p1.bslClubId === p2.bslClubId ? p1.bslClubId : null;
        const club = clubId != null ? cMap.get(clubId) : null;
        row = {
          pairKey: key,
          player1Id: lo,
          player1Name: p1.resolvedName,
          player2Id: hi,
          player2Name: p2.resolvedName,
          clubId: clubId ?? null,
          clubName: club?.name || "—",
          clubLogo: club?.logoUrl || null,
          division: (club?.division as string) || "—",
          matchesPlayed: 0,
          won: 0,
          lost: 0,
          setsFor: 0,
          setsAgainst: 0,
          winRate: 0,
          points: 0,
        };
        byPair.set(key, row);
      }
      return row;
    };
    for (const r of finished) {
      const rp = rubberRallyPoints(r);
      const homeWon = rp.homeSetsWon > rp.awaySetsWon;
      const awayWon = rp.awaySetsWon > rp.homeSetsWon;
      if (r.homePlayer1Id != null && r.homePlayer2Id != null) {
        const row = ensure(r.homePlayer1Id, r.homePlayer2Id);
        if (row) {
          row.matchesPlayed++;
          row.setsFor += rp.homeSetsWon;
          row.setsAgainst += rp.awaySetsWon;
          row.points += rp.home;
          if (homeWon) row.won++;
          else if (awayWon) row.lost++;
        }
      }
      if (r.awayPlayer1Id != null && r.awayPlayer2Id != null) {
        const row = ensure(r.awayPlayer1Id, r.awayPlayer2Id);
        if (row) {
          row.matchesPlayed++;
          row.setsFor += rp.awaySetsWon;
          row.setsAgainst += rp.homeSetsWon;
          row.points += rp.away;
          if (awayWon) row.won++;
          else if (homeWon) row.lost++;
        }
      }
    }
    let rows = Array.from(byPair.values()).map((r) => ({
      ...r,
      winRate:
        r.matchesPlayed > 0 ? Math.round((r.won / r.matchesPlayed) * 100) : 0,
    }));
    if (division) rows = rows.filter((r) => r.division === division);
    rows.sort(
      (a, b) =>
        b.points - a.points ||
        b.setsFor - b.setsAgainst - (a.setsFor - a.setsAgainst) ||
        b.matchesPlayed - a.matchesPlayed ||
        a.player1Name.localeCompare(b.player1Name),
    );
    return Response.json(rows.map((r, i) => ({ ...r, position: i + 1 })));
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
