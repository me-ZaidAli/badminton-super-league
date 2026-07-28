// Shared BSL helpers used across multiple route handlers.
// All functions that previously took Express `req` now take a `user` argument.

import { db } from "./db";
import { eq, desc, and, or, sql, inArray, asc, isNull } from "drizzle-orm";
import {
  bslLeagues,
  bslClubs,
  bslTeams,
  bslPlayers,
  bslLeagueDays,
  bslChallenges,
  bslFixtures,
  bslRubbers,
  bslWalletTransactions,
  bslAuditLog,
  users,
  bslTeamMembers,
  bslCategorySettings,
  bslFixtureVersions,
  bslPrizes,
} from "./schema";
import { isAdmin } from "./session";
import { invalidateBslSummary } from "./bsl-summary";

// ─── Constants ────────────────────────────────────────────────────────────────

export const ALLOWED_CATS = ["MD", "WD", "XD"] as const;
export type Cat = (typeof ALLOWED_CATS)[number];

export const DEFAULT_CVC_TYPES: string[] = ["MD", "MD", "WD", "WD", "XD", "XD"];

export const ALLOWED_RUBBER_TYPES = new Set([
  "MS1",
  "MS2",
  "WS",
  "MD",
  "WD",
  "XD",
]);
export const ALLOWED_SCORING = new Set(["DEUCE", "GOLDEN_POINT", "RALLY"]);
export const ALLOWED_FORMAT = new Set(["ROUND_ROBIN", "KNOCKOUT", "GROUPS"]);
export const ALLOWED_TIEBREAKS = new Set([
  "POINTS",
  "RUBBER_DIFF",
  "RUBBERS_FOR",
  "HEAD_TO_HEAD",
  "MATCHES_WON",
]);
export const ALLOWED_LIFECYCLE_STATES = new Set([
  "DRAFT",
  "PUBLISHED",
  "LIVE",
  "CLOSED",
]);

export const STATE_TRANSITIONS: Record<string, Set<string>> = {
  DRAFT: new Set(["DRAFT", "PUBLISHED", "LIVE", "CLOSED"]),
  PUBLISHED: new Set(["DRAFT", "PUBLISHED", "LIVE", "CLOSED"]),
  LIVE: new Set(["LIVE", "PUBLISHED", "CLOSED"]),
  CLOSED: new Set(["CLOSED", "PUBLISHED"]),
};

// ─── Rally / Score Helpers ─────────────────────────────────────────────────────

export function rubberRallyPoints(r: any): {
  home: number;
  away: number;
  homeSetsWon: number;
  awaySetsWon: number;
} {
  const out = { home: 0, away: 0, homeSetsWon: 0, awaySetsWon: 0 };
  const sets =
    Array.isArray(r?.setScores) && r.setScores.length
      ? r.setScores.map((s: any) => ({
          h: Number(s?.h) || 0,
          a: Number(s?.a) || 0,
        }))
      : (r?.homeScore || 0) > 0 || (r?.awayScore || 0) > 0
        ? [{ h: Number(r.homeScore) || 0, a: Number(r.awayScore) || 0 }]
        : [];
  for (const s of sets) {
    out.home += s.h;
    out.away += s.a;
    if (s.h > s.a) out.homeSetsWon++;
    else if (s.a > s.h) out.awaySetsWon++;
  }
  return out;
}

export function computeFixtureScore(rubberRows: any[]): {
  homePoints: number;
  awayPoints: number;
  homeSets: number;
  awaySets: number;
} {
  let homePoints = 0,
    awayPoints = 0,
    homeSets = 0,
    awaySets = 0;
  for (const r of rubberRows || []) {
    const sets =
      Array.isArray(r?.setScores) && r.setScores.length
        ? r.setScores.map((s: any) => ({
            h: Number(s?.h) || 0,
            a: Number(s?.a) || 0,
          }))
        : (r?.homeScore || 0) > 0 || (r?.awayScore || 0) > 0
          ? [{ h: Number(r.homeScore) || 0, a: Number(r.awayScore) || 0 }]
          : [];
    for (const s of sets) {
      homePoints += s.h;
      awayPoints += s.a;
      if (s.h > s.a) homeSets++;
      else if (s.a > s.h) awaySets++;
    }
  }
  return { homePoints, awayPoints, homeSets, awaySets };
}

// ─── Standings Recompute ───────────────────────────────────────────────────────

export async function recomputeStandings(_leagueId = 1) {
  const teams = await db.select().from(bslTeams);
  const fixtures = await db.select().from(bslFixtures);
  const finished = fixtures.filter((f) => f.status === "FINISHED");

  let categorySettings: Record<string, any> = {};
  try {
    const rows = await db.select().from(bslCategorySettings);
    categorySettings = Object.fromEntries(rows.map((r) => [r.category, r]));
  } catch {
    /* table absent → defaults */
  }

  const [league] = await db
    .select()
    .from(bslLeagues)
    .where(eq(bslLeagues.id, 1))
    .limit(1);
  const defaultPts = {
    win: league?.pointsWin ?? 3,
    draw: league?.pointsDraw ?? 1,
    loss: league?.pointsLoss ?? 0,
  };

  const stats: Record<
    number,
    {
      p: number;
      w: number;
      d: number;
      l: number;
      rf: number;
      ra: number;
      pts: number;
    }
  > = {};
  teams.forEach((t) => {
    stats[t.id] = { p: 0, w: 0, d: 0, l: 0, rf: 0, ra: 0, pts: 0 };
  });

  function pointsFor(f: any) {
    const snap =
      (f?.rulesSnapshot as any) ||
      (f?.category ? categorySettings[f.category] : null);
    return {
      win: Number(snap?.pointsWin ?? defaultPts.win),
      draw: Number(snap?.pointsDraw ?? defaultPts.draw),
      loss: Number(snap?.pointsLoss ?? defaultPts.loss),
    };
  }

  function rubberSets(r: any): { hs: number; as: number } {
    let hs = 0,
      as = 0;
    const sets =
      Array.isArray(r?.setScores) && r.setScores.length
        ? r.setScores.map((s: any) => ({
            h: Number(s?.h) || 0,
            a: Number(s?.a) || 0,
          }))
        : (r?.homeScore || 0) > 0 || (r?.awayScore || 0) > 0
          ? [{ h: Number(r.homeScore) || 0, a: Number(r.awayScore) || 0 }]
          : [];
    for (const s of sets) {
      if (s.h > s.a) hs++;
      else if (s.a > s.h) as++;
    }
    return { hs, as };
  }

  for (const f of finished) {
    if (
      f.homeTeamId != null &&
      f.awayTeamId != null &&
      (f.homeClubId == null || f.awayClubId == null)
    ) {
      const h = stats[f.homeTeamId];
      const a = stats[f.awayTeamId];
      if (!h || !a) continue;
      h.p++;
      a.p++;
      h.rf += f.homeRubbers;
      h.ra += f.awayRubbers;
      a.rf += f.awayRubbers;
      a.ra += f.homeRubbers;
      if (f.homeRubbers > f.awayRubbers) {
        h.w++;
        a.l++;
      } else if (f.homeRubbers < f.awayRubbers) {
        a.w++;
        h.l++;
      } else {
        h.d++;
        a.d++;
      }
    }
  }

  const finishedClubFixtures = finished.filter(
    (f) => f.homeClubId != null && f.awayClubId != null,
  );
  const finishedClubFixtureIds = finishedClubFixtures.map((f) => f.id);
  const fixturePtsRule = new Map<
    number,
    { win: number; draw: number; loss: number }
  >();
  for (const f of finishedClubFixtures) fixturePtsRule.set(f.id, pointsFor(f));

  if (finishedClubFixtureIds.length) {
    const rubbers = await db
      .select()
      .from(bslRubbers)
      .where(inArray(bslRubbers.bslFixtureId, finishedClubFixtureIds));
    for (const r of rubbers) {
      if (r.homeTeamId == null || r.awayTeamId == null) continue;
      const h = stats[r.homeTeamId];
      const a = stats[r.awayTeamId];
      if (!h || !a) continue;
      const { hs, as: asv } = rubberSets(r);
      if (hs === 0 && asv === 0) continue;
      h.p++;
      a.p++;
      h.rf += hs;
      h.ra += asv;
      a.rf += asv;
      a.ra += hs;
      if (hs > asv) {
        h.w++;
        a.l++;
      } else if (hs < asv) {
        a.w++;
        h.l++;
      } else {
        h.d++;
        a.d++;
      }
    }
  }

  const ptsRule = {
    win: defaultPts.win,
    draw: defaultPts.draw,
    loss: defaultPts.loss,
  };

  for (const t of teams) {
    const s = stats[t.id];
    s.pts = s.w * ptsRule.win + s.d * ptsRule.draw + s.l * ptsRule.loss;
    await db
      .update(bslTeams)
      .set({
        played: s.p,
        won: s.w,
        drawn: s.d,
        lost: s.l,
        rubbersFor: s.rf,
        rubbersAgainst: s.ra,
        points: s.pts,
      })
      .where(eq(bslTeams.id, t.id));
  }
  invalidateBslSummary();
}

// ─── Player Helpers ────────────────────────────────────────────────────────────

export async function loadResolvedPlayers() {
  const players = await db.select().from(bslPlayers);
  const userIds = Array.from(
    new Set(players.map((p) => p.userId).filter((x): x is number => x != null)),
  );
  const userRows = userIds.length
    ? await db
        .select({ id: users.id, fullName: users.fullName })
        .from(users)
        .where(inArray(users.id, userIds))
    : [];
  const uMap = new Map(userRows.map((u) => [u.id, u]));
  return players.map((p) => ({
    ...p,
    resolvedName:
      uMap.get(p.userId)?.fullName || p.displayName || `Player #${p.id}`,
  }));
}

export type PlayerLbRow = {
  playerId: number;
  fullName: string;
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
  position: number;
};

export async function computePlayerLeaderboard(
  division?: string,
): Promise<PlayerLbRow[]> {
  const finished = await db
    .select()
    .from(bslRubbers)
    .where(eq(bslRubbers.status, "FINISHED" as any));
  const players = await loadResolvedPlayers();
  const clubs = await db.select().from(bslClubs);
  const cMap = new Map(clubs.map((c) => [c.id, c]));
  const byPlayer = new Map<number, Omit<PlayerLbRow, "position">>();

  const ensure = (p: any) => {
    if (!p) return null;
    let row = byPlayer.get(p.id);
    if (!row) {
      const club = p.bslClubId != null ? cMap.get(p.bslClubId) : null;
      row = {
        playerId: p.id,
        fullName: p.resolvedName,
        clubId: p.bslClubId ?? null,
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
      byPlayer.set(p.id, row);
    }
    return row;
  };

  const pMap = new Map(players.map((p) => [p.id, p]));
  for (const p of players) ensure(p);

  for (const r of finished) {
    const rp = rubberRallyPoints(r);
    const homeWon = rp.home > rp.away;
    const awayWon = rp.away > rp.home;
    const homePlayers = [r.homePlayer1Id, r.homePlayer2Id].filter(
      (x): x is number => x != null,
    );
    const awayPlayers = [r.awayPlayer1Id, r.awayPlayer2Id].filter(
      (x): x is number => x != null,
    );
    for (const pid of homePlayers) {
      const row = ensure(pMap.get(pid));
      if (!row) continue;
      row.matchesPlayed++;
      row.setsFor += rp.homeSetsWon;
      row.setsAgainst += rp.awaySetsWon;
      row.points += rp.home;
      if (homeWon) row.won++;
      else if (awayWon) row.lost++;
    }
    for (const pid of awayPlayers) {
      const row = ensure(pMap.get(pid));
      if (!row) continue;
      row.matchesPlayed++;
      row.setsFor += rp.awaySetsWon;
      row.setsAgainst += rp.homeSetsWon;
      row.points += rp.away;
      if (awayWon) row.won++;
      else if (homeWon) row.lost++;
    }
  }

  let rows = Array.from(byPlayer.values()).map((r) => ({
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
      a.fullName.localeCompare(b.fullName),
  );
  return rows.map((r, i) => ({ ...r, position: i + 1 }));
}

// ─── Fixture Helpers ───────────────────────────────────────────────────────────

export async function assertFixtureMutable(
  fixtureId: number,
  allowedActions: Set<string>,
  action: string,
): Promise<string | null> {
  const [f] = await db
    .select()
    .from(bslFixtures)
    .where(eq(bslFixtures.id, fixtureId))
    .limit(1);
  if (!f || f.bslLeagueDayId == null) return null;
  const [day] = await db
    .select()
    .from(bslLeagueDays)
    .where(eq(bslLeagueDays.id, f.bslLeagueDayId))
    .limit(1);
  if (!day) return null;
  const state = (day.state || "DRAFT").toUpperCase();
  if (state === "CLOSED") return `League day is CLOSED — no edits allowed`;
  if (state === "LIVE" && !allowedActions.has(action))
    return `League day is LIVE — only ${[...allowedActions].join("/")} allowed`;
  return null;
}

export function assertFixtureStructural(_fixture: any): null {
  return null;
}

export async function resolveFixtureDivision(
  fixture: any,
): Promise<string | null> {
  if (!fixture?.bslLeagueDayId) return null;
  const [day] = await db
    .select({ division: bslLeagueDays.division })
    .from(bslLeagueDays)
    .where(eq(bslLeagueDays.id, fixture.bslLeagueDayId))
    .limit(1);
  return (day as any)?.division || null;
}

// ─── Grade Helpers ─────────────────────────────────────────────────────────────

export function isGradeAllowedInDivision(
  grade: string | null | undefined,
  division: string | null | undefined,
  divisionGrades: Record<string, string[]> | null | undefined,
): boolean {
  if (!division) return true;
  const map = divisionGrades || {};
  const allowed = Array.isArray(map[division]) ? map[division] : [];
  if (allowed.length === 0) return true;
  if (!grade) return false;
  return allowed.includes(grade);
}

// ─── Club Management Helpers ───────────────────────────────────────────────────

export async function loadOwnedClub(
  user: any,
): Promise<{ club: any | null; canManage: boolean }> {
  if (!user) return { club: null, canManage: false };
  const [club] = await db
    .select()
    .from(bslClubs)
    .where(
      or(
        eq(bslClubs.managerUserId, user.id),
        sql`${bslClubs.adminUserIds} @> ARRAY[${user.id}]::int[]`,
      ),
    )
    .limit(1);
  return { club: club ?? null, canManage: !!club || isAdmin(user) };
}

export async function loadClubForManager(
  user: any,
  clubId: number,
): Promise<{ club: any | null; reason?: string }> {
  const [club] = await db
    .select()
    .from(bslClubs)
    .where(eq(bslClubs.id, clubId))
    .limit(1);
  if (!club) return { club: null, reason: "Club not found" };
  const isOwnerOfClub = club.managerUserId === user.id;
  const isClubAdmin =
    Array.isArray((club as any).adminUserIds) &&
    (club as any).adminUserIds.includes(user.id);
  if (!isOwnerOfClub && !isClubAdmin && !isAdmin(user))
    return { club: null, reason: "Not your club" };
  return { club };
}

export async function canManageBslClub(
  user: any,
  clubId: number,
): Promise<boolean> {
  if (!user) return false;
  if (user.role === "OWNER" || user.role === "ADMIN") return true;
  const [club] = await db
    .select()
    .from(bslClubs)
    .where(eq(bslClubs.id, clubId))
    .limit(1);
  if (!club) return false;
  if (club.managerUserId === user.id) return true;
  if (
    Array.isArray((club as any).adminUserIds) &&
    (club as any).adminUserIds.includes(user.id)
  )
    return true;
  const teams = await db
    .select()
    .from(bslTeams)
    .where(
      and(
        eq(bslTeams.bslClubId, clubId),
        sql`${bslTeams.captainPlayerId} IS NOT NULL`,
      ),
    );
  const capIds = teams.map((t) => t.captainPlayerId as number).filter(Boolean);
  if (capIds.length === 0) return false;
  const caps = await db
    .select()
    .from(bslPlayers)
    .where(inArray(bslPlayers.id, capIds));
  return caps.some((c) => c.userId === user.id);
}

// ─── Challenge Zone Helpers ────────────────────────────────────────────────────

export async function slotsUsedForDay(
  leagueDayId: number,
  excludeChallengeId?: number,
): Promise<number> {
  const rows = await db
    .select()
    .from(bslChallenges)
    .where(
      and(
        eq(bslChallenges.leagueDayId, leagueDayId),
        inArray(bslChallenges.status, ["PENDING", "ACCEPTED"]),
      ),
    );
  return rows
    .filter((r) => excludeChallengeId == null || r.id !== excludeChallengeId)
    .reduce((s, r) => s + (r.numMatches || 0), 0);
}

// ─── Settings Helpers ──────────────────────────────────────────────────────────

export function clampInt(
  v: any,
  min: number,
  max: number,
  fallback: number,
): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

export function sanitiseSettings(body: any, base?: any) {
  const merged: any = { ...(base || {}) };
  if ("rubbersPerFixture" in body)
    merged.rubbersPerFixture = clampInt(
      body.rubbersPerFixture,
      1,
      20,
      base?.rubbersPerFixture ?? 6,
    );
  if ("setsPerMatch" in body)
    merged.setsPerMatch = clampInt(
      body.setsPerMatch,
      1,
      7,
      base?.setsPerMatch ?? 3,
    );
  if ("pointsPerSet" in body)
    merged.pointsPerSet = clampInt(
      body.pointsPerSet,
      1,
      99,
      base?.pointsPerSet ?? 21,
    );
  if ("deuceCap" in body)
    merged.deuceCap = clampInt(body.deuceCap, 1, 99, base?.deuceCap ?? 30);
  if ("walkoverScore" in body)
    merged.walkoverScore = clampInt(
      body.walkoverScore,
      0,
      99,
      base?.walkoverScore ?? 21,
    );
  if ("pointsWin" in body)
    merged.pointsWin = clampInt(body.pointsWin, 0, 99, base?.pointsWin ?? 3);
  if ("pointsDraw" in body)
    merged.pointsDraw = clampInt(body.pointsDraw, 0, 99, base?.pointsDraw ?? 1);
  if ("pointsLoss" in body)
    merged.pointsLoss = clampInt(body.pointsLoss, 0, 99, base?.pointsLoss ?? 0);
  if ("scoringRule" in body && ALLOWED_SCORING.has(body.scoringRule))
    merged.scoringRule = body.scoringRule;
  if ("format" in body && ALLOWED_FORMAT.has(body.format))
    merged.format = body.format;
  if ("walkoverPolicy" in body && typeof body.walkoverPolicy === "string")
    merged.walkoverPolicy = body.walkoverPolicy.slice(0, 32);
  if ("notes" in body)
    merged.notes = body.notes ? String(body.notes).slice(0, 1000) : null;
  if ("rubberLineup" in body && Array.isArray(body.rubberLineup)) {
    const cleaned = body.rubberLineup
      .map((t: any) => String(t || "").toUpperCase())
      .filter((t: string) => ALLOWED_RUBBER_TYPES.has(t));
    if (cleaned.length > 0) merged.rubberLineup = cleaned;
  }
  if ("tiebreakOrder" in body && Array.isArray(body.tiebreakOrder)) {
    const cleaned = body.tiebreakOrder
      .map((t: any) => String(t || "").toUpperCase())
      .filter((t: string) => ALLOWED_TIEBREAKS.has(t));
    if (cleaned.length > 0) merged.tiebreakOrder = cleaned;
  }
  if ("courtPool" in body && Array.isArray(body.courtPool)) {
    const cleaned = body.courtPool
      .map((c: any) => Number(c))
      .filter((c: number) => Number.isFinite(c) && c >= 1 && c <= 99)
      .map((c: number) => Math.round(c));
    merged.courtPool = Array.from(new Set(cleaned));
  }
  return merged;
}

export async function loadCategorySettings(
  category: string | null | undefined,
) {
  if (!category) return null;
  const [row] = await db
    .select()
    .from(bslCategorySettings)
    .where(
      and(
        eq(bslCategorySettings.bslLeagueId, 1),
        eq(bslCategorySettings.category, category),
      ),
    )
    .limit(1);
  return row || null;
}
