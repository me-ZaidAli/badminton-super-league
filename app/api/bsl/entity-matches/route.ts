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
    const sp = new URL(req.url).searchParams;
    const kind = String(sp.get("kind") || "");
    const id = sp.get("id") ? Number(sp.get("id")) : null;
    const id2 = sp.get("id2") ? Number(sp.get("id2")) : null;
    const finished = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.status, "FINISHED" as any));
    const players = await loadResolvedPlayers();
    const clubs = await db.select().from(bslClubs);
    const fixtures = await db.select().from(bslFixtures);
    const teams = await db.select().from(bslTeams);
    const pMap = new Map(players.map((p) => [p.id, p]));
    const cMap = new Map(clubs.map((c) => [c.id, c]));
    const fMap = new Map(fixtures.map((f) => [f.id, f]));
    const tMap = new Map(teams.map((t) => [t.id, t]));
    const nameOf = (pid: number | null) =>
      pid != null ? (pMap.get(pid)?.resolvedName ?? `Player #${pid}`) : "";
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
    type Match = {
      rubberId: number;
      fixtureId: number;
      date: string | null;
      rubberType: string | null;
      homePlayers: { id: number; name: string }[];
      awayPlayers: { id: number; name: string }[];
      homeClubId: number | null;
      awayClubId: number | null;
      homeClubName: string;
      awayClubName: string;
      homeScore: number;
      awayScore: number;
      homePoints: number;
      awayPoints: number;
      weFor: number;
      weAgainst: number;
      wePointsFor: number;
      wePointsAgainst: number;
      result: "WIN" | "LOSS" | "DRAW";
    };
    const out: Match[] = [];
    for (const r of finished) {
      const hps = [r.homePlayer1Id, r.homePlayer2Id].filter(
        (x): x is number => x != null,
      );
      const aps = [r.awayPlayer1Id, r.awayPlayer2Id].filter(
        (x): x is number => x != null,
      );
      const fx = fMap.get(r.bslFixtureId);
      const homeClubId = sideClub(r.homeTeamId ?? null, fx?.homeClubId);
      const awayClubId = sideClub(r.awayTeamId ?? null, fx?.awayClubId);
      let isHome: boolean | null = null;
      if (kind === "player" && id != null) {
        if (hps.includes(id)) isHome = true;
        else if (aps.includes(id)) isHome = false;
      } else if (kind === "club" && id != null) {
        if (homeClubId === id) isHome = true;
        else if (awayClubId === id) isHome = false;
      } else if (kind === "pair" && id != null && id2 != null) {
        const has = (arr: number[]) => arr.includes(id) && arr.includes(id2);
        if (has(hps)) isHome = true;
        else if (has(aps)) isHome = false;
      }
      if (isHome == null) continue;
      const hs = r.homeScore || 0,
        as = r.awayScore || 0;
      const weFor = isHome ? hs : as;
      const weAgainst = isHome ? as : hs;
      const rp = rubberRallyPoints(r);
      const wePointsFor = isHome ? rp.home : rp.away;
      const wePointsAgainst = isHome ? rp.away : rp.home;
      out.push({
        rubberId: r.id,
        fixtureId: r.bslFixtureId,
        date: fx?.startTime
          ? new Date(fx.startTime as any).toISOString()
          : null,
        rubberType: r.rubberType ?? null,
        homePlayers: hps.map((pid) => ({ id: pid, name: nameOf(pid) })),
        awayPlayers: aps.map((pid) => ({ id: pid, name: nameOf(pid) })),
        homeClubId,
        awayClubId,
        homeClubName:
          homeClubId != null ? cMap.get(homeClubId)?.name || "—" : "—",
        awayClubName:
          awayClubId != null ? cMap.get(awayClubId)?.name || "—" : "—",
        homeScore: hs,
        awayScore: as,
        homePoints: rp.home,
        awayPoints: rp.away,
        weFor,
        weAgainst,
        wePointsFor,
        wePointsAgainst,
        result:
          wePointsFor > wePointsAgainst
            ? "WIN"
            : wePointsFor < wePointsAgainst
              ? "LOSS"
              : "DRAW",
      });
    }
    out.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    return Response.json(out);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
