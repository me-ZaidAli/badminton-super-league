import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/routing";
import {
  Trophy,
  ChevronRight,
  ChevronDown,
  Calendar,
  Medal,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BslSubNav } from "@/components/BslSubNav";
import { BSL } from "@/components/bsl/BSLPalette";
import { format } from "date-fns";

type Fixture = {
  id: number;
  bslLeagueDayId: number | null;
  startTime: string | null;
  status: string;
  homeTeamName: string;
  awayTeamName: string;
  homeRubbers: number;
  awayRubbers: number;
  homePoints?: number;
  awayPoints?: number;
  homeSets?: number;
  awaySets?: number;
  category?: string | null;
  homeClubLogo: string | null;
  awayClubLogo: string | null;
};

type LeagueDay = {
  id: number;
  date: string;
  venue?: string | null;
  state?: string | null;
};
type Standing = {
  id: number;
  position: number;
  clubName: string;
  clubLogo: string | null;
  division: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  rubbersFor: number;
  rubbersAgainst: number;
  rubberDiff: number;
  points: number;
};

export default function BslResults() {
  // Poll fixtures + standings every 10s so results update live for everyone as
  // the admin enters scores in Quick Results.
  const { data: fixtures = [] } = useQuery<Fixture[]>({
    queryKey: ["/api/bsl/fixtures"],
    refetchInterval: 10000,
  });
  const { data: standings = [] } = useQuery<Standing[]>({
    queryKey: ["/api/bsl/standings"],
    refetchInterval: 10000,
  });
  const { data: leagueDays = [] } = useQuery<LeagueDay[]>({
    queryKey: ["/api/bsl/league-days"],
  });

  const [expanded, setExpanded] = useState<Set<number>>(new Set());

  const dayMap = useMemo(
    () => new Map(leagueDays.map((d) => [d.id, d])),
    [leagueDays],
  );

  const grouped = useMemo(() => {
    const finished = fixtures.filter(
      (f) =>
        f.status === "FINISHED" ||
        f.status === "LIVE" ||
        f.status === "WARMUP" ||
        f.homeRubbers + f.awayRubbers > 0,
    );
    const byDay = new Map<
      string,
      { dayId: number | null; date: Date | null; fixtures: Fixture[] }
    >();
    finished.forEach((f) => {
      const dayId = f.bslLeagueDayId;
      const dayRow = dayId != null ? dayMap.get(dayId) : null;
      const dateStr = dayRow?.date || f.startTime;
      const key = dateStr ? format(new Date(dateStr), "yyyy-MM-dd") : "unknown";
      if (!byDay.has(key)) {
        byDay.set(key, {
          dayId: dayId ?? null,
          date: dateStr ? new Date(dateStr) : null,
          fixtures: [],
        });
      }
      byDay.get(key)!.fixtures.push(f);
    });
    return Array.from(byDay.entries())
      .map(([key, val]) => ({ key, ...val }))
      .sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  }, [fixtures, dayMap]);

  const toggle = (dayId: number | null, idx: number) => {
    const id = dayId ?? -idx;
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />

      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 md:pt-8 space-y-6">
        {/* HEADER */}
        <div
          className="rounded-2xl px-5 py-5 border"
          style={{
            borderColor: `${BSL.cyan}33`,
            background: `linear-gradient(135deg, ${BSL.cyan}14, ${BSL.gold}10)`,
          }}
          data-testid="results-header"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: `${BSL.gold}22`,
                border: `1px solid ${BSL.gold}55`,
              }}
            >
              <Trophy className="h-5 w-5" style={{ color: BSL.gold }} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Results & Standings
              </h1>
              <p className="text-xs md:text-sm text-white/60">
                Browse past match days and see how every club is doing.
              </p>
            </div>
          </div>
        </div>

        {/* LEADERBOARD */}
        <div
          className="rounded-2xl border overflow-hidden"
          style={{
            borderColor: `${BSL.cyan}33`,
            background: "hsla(222,55%,4%,0.55)",
          }}
          data-testid="leaderboard-section"
        >
          <div
            className="px-4 py-3 flex items-center gap-2 border-b"
            style={{ borderColor: `${BSL.cyan}22` }}
          >
            <Medal className="h-4 w-4" style={{ color: BSL.gold }} />
            <h2 className="font-bold text-sm tracking-wider uppercase">
              Club Leaderboard
            </h2>
          </div>
          {standings.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-white/50">
              No results in yet.
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: `${BSL.cyan}10` }}>
              <div className="grid grid-cols-12 gap-2 px-4 py-2 text-[10px] uppercase tracking-wider text-white/50 font-bold">
                <div className="col-span-1">#</div>
                <div className="col-span-5">Club</div>
                <div className="col-span-2 text-center">P</div>
                <div className="col-span-2 text-center">+/−</div>
                <div className="col-span-2 text-right">PTS</div>
              </div>
              {standings.map((s) => (
                <div
                  key={s.id}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center text-sm hover:bg-white/[0.03] transition-colors"
                  data-testid={`leaderboard-row-${s.id}`}
                >
                  <div
                    className="col-span-1 font-extrabold tabular-nums"
                    style={{ color: s.position <= 3 ? BSL.gold : "white" }}
                  >
                    {s.position}
                  </div>
                  <div className="col-span-5 flex items-center gap-2 min-w-0">
                    {s.clubLogo ? (
                      <img
                        src={s.clubLogo}
                        alt=""
                        className="w-6 h-6 rounded-md object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-md bg-white/10 flex-shrink-0" />
                    )}
                    <span className="truncate font-semibold">{s.clubName}</span>
                  </div>
                  <div className="col-span-2 text-center tabular-nums text-white/70">
                    {s.played}
                  </div>
                  <div className="col-span-2 text-center tabular-nums">
                    <span
                      className={
                        s.rubberDiff >= 0 ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {s.rubberDiff >= 0 ? "+" : ""}
                      {s.rubberDiff}
                    </span>
                  </div>
                  <div
                    className="col-span-2 text-right font-extrabold tabular-nums"
                    style={{ color: BSL.cyan }}
                  >
                    {s.points}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MATCH DAYS */}
        <div className="space-y-3" data-testid="match-days-list">
          <div className="flex items-center gap-2 px-1">
            <Calendar className="h-4 w-4" style={{ color: BSL.cyan }} />
            <h2 className="font-bold text-sm tracking-wider uppercase">
              Match Days
            </h2>
          </div>

          {grouped.length === 0 ? (
            <div
              className="rounded-2xl border px-4 py-12 text-center text-sm text-white/50"
              style={{ borderColor: `${BSL.cyan}22` }}
            >
              No finished matches yet — once results are entered they'll show
              here.
            </div>
          ) : (
            grouped.map((g, idx) => {
              const id = g.dayId ?? -idx;
              const isOpen = expanded.has(id);
              const dayMeta = g.dayId != null ? dayMap.get(g.dayId) : null;
              const dateLabel = g.date
                ? format(g.date, "EEEE, d MMM yyyy")
                : "Unscheduled";
              return (
                <div
                  key={g.key}
                  className="rounded-2xl border overflow-hidden"
                  style={{
                    borderColor: `${BSL.cyan}33`,
                    background: "hsla(222,55%,4%,0.55)",
                  }}
                  data-testid={`match-day-${id}`}
                >
                  <button
                    type="button"
                    className="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors text-left"
                    onClick={() => toggle(g.dayId ?? null, idx)}
                    data-testid={`toggle-match-day-${id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-lg flex flex-col items-center justify-center"
                        style={{
                          background: `${BSL.cyan}18`,
                          border: `1px solid ${BSL.cyan}44`,
                        }}
                      >
                        <span
                          className="text-xs font-extrabold tabular-nums leading-none"
                          style={{ color: BSL.cyan }}
                        >
                          {g.date ? format(g.date, "d") : "—"}
                        </span>
                        <span className="text-[9px] font-bold tracking-wider mt-0.5 text-white/60">
                          {g.date ? format(g.date, "MMM").toUpperCase() : ""}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold truncate">{dateLabel}</div>
                        <div className="text-[11px] text-white/60 truncate">
                          {g.fixtures.length} match
                          {g.fixtures.length === 1 ? "" : "es"}
                          {dayMeta?.venue ? ` · ${dayMeta.venue}` : ""}
                        </div>
                      </div>
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 text-white/60 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-white/60 flex-shrink-0" />
                    )}
                  </button>

                  {isOpen && (
                    <div
                      className="border-t divide-y"
                      style={{ borderColor: `${BSL.cyan}22` }}
                    >
                      {g.fixtures.map((f) => {
                        const homePts = f.homePoints ?? 0;
                        const awayPts = f.awayPoints ?? 0;
                        const homeWon = homePts > awayPts;
                        const awayWon = awayPts > homePts;
                        const isLive =
                          f.status === "LIVE" || f.status === "WARMUP";
                        return (
                          <Link key={f.id} href={`/match/${f.id}`}>
                            <div
                              className="px-4 py-3 grid grid-cols-12 gap-2 items-center hover:bg-white/[0.04] cursor-pointer transition-colors"
                              data-testid={`fixture-result-${f.id}`}
                            >
                              <div className="col-span-5 flex items-center gap-2 min-w-0">
                                {f.homeClubLogo ? (
                                  <img
                                    src={f.homeClubLogo}
                                    alt=""
                                    className="w-5 h-5 rounded object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded bg-white/10" />
                                )}
                                <span
                                  className={`truncate text-sm ${homeWon ? "font-extrabold text-white" : "text-white/70"}`}
                                >
                                  {f.homeTeamName}
                                </span>
                              </div>
                              <div className="col-span-2 text-center">
                                <div
                                  className="font-extrabold tabular-nums"
                                  style={{ color: BSL.gold }}
                                  data-testid={`fixture-points-${f.id}`}
                                >
                                  {homePts}{" "}
                                  <span className="text-white/40 font-medium">
                                    –
                                  </span>{" "}
                                  {awayPts}
                                </div>
                                <div className="text-[9px] uppercase tracking-wider text-white/40">
                                  {f.homeRubbers}–{f.awayRubbers} rub
                                </div>
                              </div>
                              <div className="col-span-5 flex items-center gap-2 min-w-0 justify-end">
                                <span
                                  className={`truncate text-sm ${awayWon ? "font-extrabold text-white" : "text-white/70"}`}
                                >
                                  {f.awayTeamName}
                                </span>
                                {f.awayClubLogo ? (
                                  <img
                                    src={f.awayClubLogo}
                                    alt=""
                                    className="w-5 h-5 rounded object-cover flex-shrink-0"
                                  />
                                ) : (
                                  <div className="w-5 h-5 rounded bg-white/10" />
                                )}
                              </div>
                              <div className="col-span-12 -mt-1 flex items-center justify-center gap-2">
                                {isLive && (
                                  <span
                                    className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold"
                                    style={{ color: BSL.danger }}
                                    data-testid={`fixture-live-${f.id}`}
                                  >
                                    <span
                                      className="inline-block h-1.5 w-1.5 rounded-full animate-pulse"
                                      style={{ background: BSL.danger }}
                                    />{" "}
                                    Live
                                  </span>
                                )}
                                {f.category && (
                                  <span className="text-[9px] uppercase tracking-wider text-white/40">
                                    {f.category}
                                  </span>
                                )}
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
