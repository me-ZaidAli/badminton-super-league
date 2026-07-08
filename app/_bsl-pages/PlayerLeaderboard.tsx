import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/routing";
import {
  ArrowLeft,
  Trophy,
  Search,
  X,
  Users,
  Building2,
  User,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BslSubNav } from "@/components/BslSubNav";
import { BSL } from "@/components/bsl/BSLPalette";

type PlayerRow = {
  position: number;
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
};
type ClubRow = {
  position: number;
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
type PairRow = {
  position: number;
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
type Tab = "players" | "clubs" | "pairs";
type Selected =
  | { kind: "player"; id: number; title: string; subtitle?: string }
  | { kind: "club"; id: number; title: string; subtitle?: string }
  | { kind: "pair"; id: number; id2: number; title: string; subtitle?: string };

function useEntityMatches(sel: Selected | null) {
  return useQuery<Match[]>({
    queryKey: [
      "/api/bsl/entity-matches",
      sel?.kind,
      (sel as any)?.id,
      (sel as any)?.id2 ?? null,
    ],
    enabled: !!sel,
    queryFn: async () => {
      if (!sel) return [];
      const qs = new URLSearchParams({
        kind: sel.kind,
        id: String((sel as any).id),
      });
      if (sel.kind === "pair") qs.set("id2", String(sel.id2));
      const r = await fetch(`/api/bsl/entity-matches?${qs.toString()}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
}

function MatchModal({
  sel,
  onClose,
}: {
  sel: Selected | null;
  onClose: () => void;
}) {
  const { data: matches = [], isLoading } = useEntityMatches(sel);
  if (!sel) return null;

  const totals = matches.reduce(
    (a, m) => {
      a.played++;
      if (m.result === "WIN") a.won++;
      else if (m.result === "LOSS") a.lost++;
      else a.drawn++;
      a.pointsFor += m.wePointsFor;
      a.pointsAgainst += m.wePointsAgainst;
      return a;
    },
    { played: 0, won: 0, lost: 0, drawn: 0, pointsFor: 0, pointsAgainst: 0 },
  );
  const winRate =
    totals.played > 0 ? Math.round((totals.won / totals.played) * 100) : 0;

  // Points margin per match (points scored minus points conceded).
  const trend = matches.map((m, i) => ({
    name: `#${i + 1}`,
    diff: m.wePointsFor - m.wePointsAgainst,
    result: m.result,
  }));
  const pie = [
    { name: "Won", value: totals.won, fill: "#10b981" },
    { name: "Lost", value: totals.lost, fill: "#f43f5e" },
    { name: "Drawn", value: totals.drawn, fill: "#64748b" },
  ].filter((p) => p.value > 0);

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
      data-testid="modal-entity-matches"
    >
      <div className="min-h-screen flex items-start justify-center p-4 md:p-8">
        <div
          className="w-full max-w-3xl rounded-2xl"
          style={{ background: BSL.card, border: `1px solid ${BSL.border}` }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-5 py-4 flex items-start justify-between gap-3"
            style={{ borderBottom: `1px solid ${BSL.border}` }}
          >
            <div>
              <div
                className="text-[10px] uppercase tracking-widest font-bold"
                style={{ color: BSL.cyan }}
              >
                {sel.kind === "player"
                  ? "Player"
                  : sel.kind === "club"
                    ? "Club"
                    : "Pair"}{" "}
                · Match history
              </div>
              <h2
                className="text-2xl font-black"
                style={{ color: BSL.gold }}
                data-testid="text-modal-title"
              >
                {sel.title}
              </h2>
              {sel.subtitle ? (
                <div className="text-xs text-white/60 mt-0.5">
                  {sel.subtitle}
                </div>
              ) : null}
            </div>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-lg inline-flex items-center justify-center hover:bg-white/10"
              data-testid="button-close-modal"
            >
              <X className="h-4 w-4 text-white/70" />
            </button>
          </div>

          {/* Headline stats */}
          <div
            className="grid grid-cols-2 md:grid-cols-4 gap-2 px-5 py-4"
            style={{ borderBottom: `1px solid ${BSL.border}` }}
          >
            {[
              { l: "Played", v: totals.played, c: "white" },
              { l: "Won", v: totals.won, c: "#10b981" },
              { l: "Lost", v: totals.lost, c: "#f43f5e" },
              { l: "Points", v: totals.pointsFor, c: BSL.gold },
            ].map((s) => (
              <div
                key={s.l}
                className="rounded-xl px-3 py-2"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: `1px solid ${BSL.border}`,
                }}
              >
                <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
                  {s.l}
                </div>
                <div
                  className="text-xl font-black tabular-nums"
                  style={{ color: s.c }}
                  data-testid={`stat-${s.l.toLowerCase().replace(/[^a-z]/g, "")}`}
                >
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          {/* Charts */}
          {totals.played > 0 ? (
            <div
              className="grid md:grid-cols-2 gap-4 px-5 py-4"
              style={{ borderBottom: `1px solid ${BSL.border}` }}
            >
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">
                  Points margin per match
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={trend}>
                      <CartesianGrid
                        stroke={BSL.border}
                        strokeDasharray="3 3"
                      />
                      <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} />
                      <YAxis
                        stroke="#94a3b8"
                        fontSize={10}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: BSL.bgDeep,
                          border: `1px solid ${BSL.border}`,
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#fff" }}
                      />
                      <Bar dataKey="diff">
                        {trend.map((t, i) => (
                          <Cell
                            key={i}
                            fill={
                              t.result === "WIN"
                                ? "#10b981"
                                : t.result === "LOSS"
                                  ? "#f43f5e"
                                  : "#64748b"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-widest text-white/50 font-bold mb-2">
                  Win / loss split
                </div>
                <div className="h-40">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={32}
                        outerRadius={60}
                        paddingAngle={2}
                      >
                        {pie.map((p, i) => (
                          <Cell key={i} fill={p.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          background: BSL.bgDeep,
                          border: `1px solid ${BSL.border}`,
                          fontSize: 12,
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : null}

          {/* Match list */}
          <div className="px-5 py-4 max-h-[50vh] overflow-y-auto">
            {isLoading ? (
              <div className="text-center text-white/40 text-sm py-8">
                Loading match history…
              </div>
            ) : matches.length === 0 ? (
              <div
                className="text-center text-white/40 text-sm py-8"
                data-testid="text-modal-empty"
              >
                No finished matches recorded yet.
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr
                    className="text-[10px] uppercase tracking-wider text-white/50 font-bold"
                    style={{ borderBottom: `1px solid ${BSL.border}` }}
                  >
                    <th className="px-2 py-2 text-left">Date</th>
                    <th className="px-2 py-2 text-left">Type</th>
                    <th className="px-2 py-2 text-left">Home</th>
                    <th className="px-2 py-2 text-center">Score</th>
                    <th className="px-2 py-2 text-left">Away</th>
                    <th className="px-2 py-2 text-center">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map((m) => (
                    <tr
                      key={m.rubberId}
                      style={{ borderBottom: `1px solid ${BSL.border}` }}
                      data-testid={`row-match-${m.rubberId}`}
                    >
                      <td className="px-2 py-2 text-white/60 tabular-nums">
                        {m.date
                          ? new Date(m.date).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                      </td>
                      <td className="px-2 py-2 text-white/60">
                        {m.rubberType || "—"}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-bold">
                          {m.homePlayers.map((p) => p.name).join(" / ") || "—"}
                        </div>
                        <div className="text-[10px] text-white/50">
                          {m.homeClubName}
                        </div>
                      </td>
                      <td
                        className="px-2 py-2 text-center font-black tabular-nums"
                        style={{ color: BSL.gold }}
                      >
                        {m.homePoints}–{m.awayPoints}
                      </td>
                      <td className="px-2 py-2">
                        <div className="font-bold">
                          {m.awayPlayers.map((p) => p.name).join(" / ") || "—"}
                        </div>
                        <div className="text-[10px] text-white/50">
                          {m.awayClubName}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-center">
                        <span
                          className="inline-block px-2 py-0.5 rounded font-black text-[10px]"
                          style={{
                            background:
                              m.result === "WIN"
                                ? "#10b98122"
                                : m.result === "LOSS"
                                  ? "#f43f5e22"
                                  : "rgba(255,255,255,0.06)",
                            color:
                              m.result === "WIN"
                                ? "#10b981"
                                : m.result === "LOSS"
                                  ? "#f43f5e"
                                  : "#cbd5e1",
                          }}
                        >
                          {m.result}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BslPlayerLeaderboard() {
  const [tab, setTab] = useState<Tab>("players");
  const [division, setDivision] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Selected | null>(null);

  const players = useQuery<PlayerRow[]>({
    queryKey: ["/api/bsl/player-leaderboard", division || "all"],
    enabled: tab === "players",
    queryFn: async () => {
      const url = division
        ? `/api/bsl/player-leaderboard?division=${encodeURIComponent(division)}`
        : `/api/bsl/player-leaderboard`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
  const clubs = useQuery<ClubRow[]>({
    queryKey: ["/api/bsl/club-leaderboard", division || "all"],
    enabled: tab === "clubs",
    queryFn: async () => {
      const url = division
        ? `/api/bsl/club-leaderboard?division=${encodeURIComponent(division)}`
        : `/api/bsl/club-leaderboard`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
  const pairs = useQuery<PairRow[]>({
    queryKey: ["/api/bsl/pair-leaderboard", division || "all"],
    enabled: tab === "pairs",
    queryFn: async () => {
      const url = division
        ? `/api/bsl/pair-leaderboard?division=${encodeURIComponent(division)}`
        : `/api/bsl/pair-leaderboard`;
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const divisions = useMemo(() => {
    const s = new Set<string>();
    [
      ...(players.data || []),
      ...(clubs.data || []),
      ...(pairs.data || []),
    ].forEach((r) => {
      if ((r as any).division && (r as any).division !== "—")
        s.add((r as any).division);
    });
    return Array.from(s).sort();
  }, [players.data, clubs.data, pairs.data]);

  const filteredPlayers = useMemo(() => {
    const n = search.trim().toLowerCase();
    return (players.data || []).filter(
      (r) =>
        !n ||
        r.fullName.toLowerCase().includes(n) ||
        r.clubName.toLowerCase().includes(n),
    );
  }, [players.data, search]);
  const filteredClubs = useMemo(() => {
    const n = search.trim().toLowerCase();
    return (clubs.data || []).filter(
      (r) => !n || r.clubName.toLowerCase().includes(n),
    );
  }, [clubs.data, search]);
  const filteredPairs = useMemo(() => {
    const n = search.trim().toLowerCase();
    return (pairs.data || []).filter(
      (r) =>
        !n ||
        r.player1Name.toLowerCase().includes(n) ||
        r.player2Name.toLowerCase().includes(n) ||
        r.clubName.toLowerCase().includes(n),
    );
  }, [pairs.data, search]);

  const activeLoading =
    (tab === "players" && players.isLoading) ||
    (tab === "clubs" && clubs.isLoading) ||
    (tab === "pairs" && pairs.isLoading);

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-6 md:pt-8 space-y-6">
        <Link href="/">
          <button
            className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white"
            data-testid="link-back-bsl"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to BSL
          </button>
        </Link>

        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-2xl inline-flex items-center justify-center"
            style={{
              background: `${BSL.gold}22`,
              border: `1px solid ${BSL.gold}55`,
              color: BSL.gold,
            }}
          >
            <Trophy className="h-6 w-6" />
          </div>
          <div>
            <h1
              className="text-3xl md:text-4xl font-black tracking-tight"
              style={{ color: BSL.gold }}
              data-testid="text-leaderboard-title"
            >
              Leaderboards
            </h1>
            <p className="text-white/60 text-sm">
              Live from every finished BSL rubber. Tap any row for the full
              match history and stats.
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 flex-wrap">
          {(
            [
              { id: "players", label: "Players", icon: User },
              { id: "clubs", label: "Clubs", icon: Building2 },
              { id: "pairs", label: "Pairs", icon: Users },
            ] as { id: Tab; label: string; icon: any }[]
          ).map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="px-4 py-2 rounded-xl text-sm font-bold inline-flex items-center gap-2"
                style={{
                  background: active
                    ? `${BSL.gold}22`
                    : "rgba(255,255,255,0.04)",
                  color: active ? BSL.gold : "white",
                  border: `1px solid ${active ? BSL.gold : BSL.border}`,
                }}
                data-testid={`tab-${t.id}`}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            );
          })}
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: BSL.card, border: `1px solid ${BSL.border}` }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
            style={{ borderBottom: `1px solid ${BSL.border}` }}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setDivision("")}
                className="px-3 py-1.5 rounded-lg text-xs font-bold"
                style={{
                  background: division === "" ? `${BSL.gold}22` : "transparent",
                  color: division === "" ? BSL.gold : "white",
                  border: `1px solid ${division === "" ? BSL.gold : BSL.border}`,
                }}
                data-testid="button-division-all"
              >
                All divisions
              </button>
              {divisions.map((d) => (
                <button
                  key={d}
                  onClick={() => setDivision(d)}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{
                    background:
                      division === d ? `${BSL.cyan}22` : "transparent",
                    color: division === d ? BSL.cyan : "white",
                    border: `1px solid ${division === d ? BSL.cyan : BSL.border}`,
                  }}
                  data-testid={`button-division-${d}`}
                >
                  {d}
                </button>
              ))}
            </div>
            <div className="relative">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  tab === "players"
                    ? "Search player or club…"
                    : tab === "clubs"
                      ? "Search club…"
                      : "Search pair or club…"
                }
                className="bg-black/40 border rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2"
                style={{ borderColor: `${BSL.cyan}33` }}
                data-testid="input-search"
              />
            </div>
          </div>

          {activeLoading ? (
            <div className="px-4 py-12 text-center text-white/40 text-sm">
              Loading…
            </div>
          ) : tab === "players" ? (
            filteredPlayers.length === 0 ? (
              <div
                className="px-4 py-12 text-center text-white/40 text-sm"
                data-testid="text-empty-players"
              >
                No finished matches yet. Player records appear once admins save
                rubber scores.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-[10px] uppercase tracking-wider text-white/50 font-bold"
                      style={{ borderBottom: `1px solid ${BSL.border}` }}
                    >
                      <th className="px-3 py-2 text-left w-12">#</th>
                      <th className="px-3 py-2 text-left">Player</th>
                      <th className="px-3 py-2 text-left">Club</th>
                      <th className="px-3 py-2 text-center">Played</th>
                      <th className="px-3 py-2 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPlayers.map((r) => {
                      const open = () =>
                        setSelected({
                          kind: "player",
                          id: r.playerId,
                          title: r.fullName,
                          subtitle: `${r.clubName}${r.division !== "—" ? ` · ${r.division}` : ""}`,
                        });
                      return (
                        <tr
                          key={r.playerId}
                          onClick={open}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              open();
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="hover:bg-white/5 cursor-pointer focus:outline-none focus:bg-white/10"
                          style={{ borderBottom: `1px solid ${BSL.border}` }}
                          data-testid={`row-player-${r.playerId}`}
                        >
                          <td
                            className="px-3 py-2 font-black tabular-nums"
                            style={{
                              color: r.position <= 3 ? BSL.gold : "white",
                            }}
                          >
                            {r.position}
                          </td>
                          <td
                            className="px-3 py-2 font-bold"
                            data-testid={`text-player-name-${r.playerId}`}
                          >
                            {r.fullName}
                          </td>
                          <td className="px-3 py-2 text-white/70">
                            <span className="inline-flex items-center gap-1.5">
                              {r.clubLogo ? (
                                <img
                                  src={r.clubLogo}
                                  alt=""
                                  className="h-4 w-4 rounded-full object-cover"
                                />
                              ) : null}
                              <span>{r.clubName}</span>
                              {r.division && r.division !== "—" ? (
                                <span className="text-[10px] font-bold opacity-60">
                                  · {r.division}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-white/50">
                            {r.matchesPlayed}
                          </td>
                          <td
                            className="px-3 py-2 text-right tabular-nums font-black text-lg"
                            style={{ color: BSL.gold }}
                            data-testid={`text-points-${r.playerId}`}
                          >
                            {r.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : tab === "clubs" ? (
            filteredClubs.length === 0 ? (
              <div
                className="px-4 py-12 text-center text-white/40 text-sm"
                data-testid="text-empty-clubs"
              >
                No clubs to rank yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr
                      className="text-[10px] uppercase tracking-wider text-white/50 font-bold"
                      style={{ borderBottom: `1px solid ${BSL.border}` }}
                    >
                      <th className="px-3 py-2 text-left w-12">#</th>
                      <th className="px-3 py-2 text-left">Club</th>
                      <th className="px-3 py-2 text-center">Players</th>
                      <th className="px-3 py-2 text-center">Played</th>
                      <th className="px-3 py-2 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClubs.map((r) => {
                      const open = () =>
                        setSelected({
                          kind: "club",
                          id: r.clubId,
                          title: r.clubName,
                          subtitle: r.division !== "—" ? r.division : undefined,
                        });
                      return (
                        <tr
                          key={r.clubId}
                          onClick={open}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              open();
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          className="hover:bg-white/5 cursor-pointer focus:outline-none focus:bg-white/10"
                          style={{ borderBottom: `1px solid ${BSL.border}` }}
                          data-testid={`row-club-${r.clubId}`}
                        >
                          <td
                            className="px-3 py-2 font-black tabular-nums"
                            style={{
                              color: r.position <= 3 ? BSL.gold : "white",
                            }}
                          >
                            {r.position}
                          </td>
                          <td className="px-3 py-2 font-bold">
                            <span className="inline-flex items-center gap-2">
                              {r.clubLogo ? (
                                <img
                                  src={r.clubLogo}
                                  alt=""
                                  className="h-5 w-5 rounded-full object-cover"
                                />
                              ) : null}
                              <span data-testid={`text-club-name-${r.clubId}`}>
                                {r.clubName}
                              </span>
                              {r.division && r.division !== "—" ? (
                                <span className="text-[10px] font-bold opacity-60">
                                  · {r.division}
                                </span>
                              ) : null}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-white/50">
                            {r.playerCount}
                          </td>
                          <td className="px-3 py-2 text-center tabular-nums text-white/50">
                            {r.played}
                          </td>
                          <td
                            className="px-3 py-2 text-right tabular-nums font-black text-lg"
                            style={{ color: BSL.gold }}
                            data-testid={`text-club-points-${r.clubId}`}
                          >
                            {r.points}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )
          ) : filteredPairs.length === 0 ? (
            <div
              className="px-4 py-12 text-center text-white/40 text-sm"
              data-testid="text-empty-pairs"
            >
              No doubles pairs ranked yet. Pairs appear once both players share
              a finished doubles rubber.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-[10px] uppercase tracking-wider text-white/50 font-bold"
                    style={{ borderBottom: `1px solid ${BSL.border}` }}
                  >
                    <th className="px-3 py-2 text-left w-12">#</th>
                    <th className="px-3 py-2 text-left">Pair</th>
                    <th className="px-3 py-2 text-left">Club</th>
                    <th className="px-3 py-2 text-center">Played</th>
                    <th className="px-3 py-2 text-right">Points</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPairs.map((r) => {
                    const title = `${r.player1Name} / ${r.player2Name}`;
                    const open = () =>
                      setSelected({
                        kind: "pair",
                        id: r.player1Id,
                        id2: r.player2Id,
                        title,
                        subtitle: r.clubName !== "—" ? r.clubName : undefined,
                      });
                    return (
                      <tr
                        key={r.pairKey}
                        onClick={open}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            open();
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="hover:bg-white/5 cursor-pointer focus:outline-none focus:bg-white/10"
                        style={{ borderBottom: `1px solid ${BSL.border}` }}
                        data-testid={`row-pair-${r.pairKey}`}
                      >
                        <td
                          className="px-3 py-2 font-black tabular-nums"
                          style={{
                            color: r.position <= 3 ? BSL.gold : "white",
                          }}
                        >
                          {r.position}
                        </td>
                        <td
                          className="px-3 py-2 font-bold"
                          data-testid={`text-pair-name-${r.pairKey}`}
                        >
                          {title}
                        </td>
                        <td className="px-3 py-2 text-white/70">
                          <span className="inline-flex items-center gap-1.5">
                            {r.clubLogo ? (
                              <img
                                src={r.clubLogo}
                                alt=""
                                className="h-4 w-4 rounded-full object-cover"
                              />
                            ) : null}
                            <span>{r.clubName}</span>
                            {r.division && r.division !== "—" ? (
                              <span className="text-[10px] font-bold opacity-60">
                                · {r.division}
                              </span>
                            ) : null}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center tabular-nums text-white/50">
                          {r.matchesPlayed}
                        </td>
                        <td
                          className="px-3 py-2 text-right tabular-nums font-black text-lg"
                          style={{ color: BSL.gold }}
                          data-testid={`text-pair-points-${r.pairKey}`}
                        >
                          {r.points}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <MatchModal sel={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
