import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link } from "@/lib/routing";
import {
  ArrowLeft,
  Save,
  Loader2,
  ClipboardEdit,
  CheckCircle2,
  Plus,
  X,
  Trash2,
  Trophy,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BSL } from "@/components/bsl/BSLPalette";
import { format } from "date-fns";

type Fixture = {
  id: number;
  startTime: string | null;
  status: string;
  homeTeamName: string;
  awayTeamName: string;
  homeClubId?: number | null;
  awayClubId?: number | null;
  homeRubbers: number;
  awayRubbers: number;
  category?: string | null;
};
type Rubber = {
  id: number;
  bslFixtureId: number;
  rubberNumber: number;
  rubberType: string;
  category?: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homeScore: number;
  awayScore: number;
  status: string;
  setScores?: Array<{ h: number; a: number }> | null;
};
type ClubInfo = { id: number; name: string } | null;
type FixtureDetail = Fixture & {
  rubbers: Rubber[];
  homeClub?: ClubInfo;
  awayClub?: ClubInfo;
};
type BslTeam = {
  id: number;
  bslClubId: number;
  name: string;
  category: string;
};
const RUBBER_TYPES = ["MS1", "MS2", "WS", "MD", "WD", "XD"] as const;

export default function BslAdminQuickResults() {
  const { toast } = useToast();
  const { data: fixtures = [] } = useQuery<Fixture[]>({
    queryKey: ["/api/bsl/fixtures"],
  });

  const [selectedId, setSelectedId] = useState<number | null>(null);

  // Default to first non-finished fixture
  useEffect(() => {
    if (selectedId == null && fixtures.length) {
      const candidate =
        fixtures.find((f) => f.status !== "FINISHED") || fixtures[0];
      setSelectedId(candidate.id);
    }
  }, [fixtures, selectedId]);

  const { data: detail, isLoading: detailLoading } = useQuery<FixtureDetail>({
    queryKey: ["/api/bsl/fixtures", selectedId],
    enabled: selectedId != null,
    queryFn: async () => {
      const r = await fetch(`/api/bsl/fixtures/${selectedId}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  // Pairs from each club so the admin can assign which pair played a rubber.
  // Club-vs-club fixtures (the only ones add-rubber supports) always have
  // homeClubId/awayClubId set; pair-vs-pair legacy fixtures fall back to
  // homeTeamId/awayTeamId on the fixture itself and aren't reassignable here.
  const homeClubId = detail?.homeClubId ?? detail?.homeClub?.id ?? null;
  const awayClubId = detail?.awayClubId ?? detail?.awayClub?.id ?? null;
  const { data: homePairs = [] } = useQuery<BslTeam[]>({
    queryKey: ["/api/bsl/clubs", homeClubId, "teams"],
    enabled: homeClubId != null,
    queryFn: async () => {
      const r = await fetch(`/api/bsl/clubs/${homeClubId}/teams`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
  const { data: awayPairs = [] } = useQuery<BslTeam[]>({
    queryKey: ["/api/bsl/clubs", awayClubId, "teams"],
    enabled: awayClubId != null,
    queryFn: async () => {
      const r = await fetch(`/api/bsl/clubs/${awayClubId}/teams`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const assignMutation = useMutation({
    mutationFn: async ({
      rubberId,
      side,
      bslTeamId,
    }: {
      rubberId: number;
      side: "home" | "away";
      bslTeamId: number | null;
    }) => {
      const r = await apiRequest(
        "PATCH",
        `/api/bsl/admin/rubbers/${rubberId}/assign`,
        { side, bslTeamId },
      );
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/bsl/fixtures", selectedId],
      });
    },
    onError: (err: any) =>
      toast({
        title: "Pair assignment failed",
        description: err?.message || "Server rejected the change.",
        variant: "destructive",
      }),
  });

  const [newRubberType, setNewRubberType] =
    useState<(typeof RUBBER_TYPES)[number]>("MD");
  const addRubberMutation = useMutation({
    mutationFn: async (rubberType: string) => {
      const r = await apiRequest(
        "POST",
        `/api/bsl/admin/fixtures/${selectedId}/add-rubber`,
        { rubberType },
      );
      return r.json();
    },
    onSuccess: () => {
      toast({
        title: "Rubber added",
        description: `New ${newRubberType} rubber appended.`,
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/bsl/fixtures", selectedId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
    },
    onError: (err: any) =>
      toast({
        title: "Could not add rubber",
        description: err?.message || "Server rejected the add.",
        variant: "destructive",
      }),
  });

  // Force-delete a rubber row (incl. scored ones). User wants full control
  // over the slate, so we always pass ?force=true. Standings recompute on the
  // backend whenever a finished rubber is removed.
  const deleteRubberMutation = useMutation({
    mutationFn: async (rubberId: number) => {
      const r = await apiRequest(
        "DELETE",
        `/api/bsl/admin/rubbers/${rubberId}?force=true`,
      );
      return r.json();
    },
    onSuccess: () => {
      toast({ title: "Rubber removed" });
      queryClient.invalidateQueries({
        queryKey: ["/api/bsl/fixtures", selectedId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/standings"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/bsl/player-leaderboard"],
      });
    },
    onError: (err: any) =>
      toast({
        title: "Could not remove rubber",
        description: err?.message || "Server rejected the delete.",
        variant: "destructive",
      }),
  });

  // Local editable scores keyed by rubber id → array of sets (strings, blanks ok).
  // Multi-set entry: each rubber may have any number of sets; winner of each set
  // = side with higher score; rubber winner = side with more sets won. The
  // backend stores both setScores (jsonb) and the derived sets-won totals into
  // homeScore/awayScore (which then feed recomputeStandings).
  const [scores, setScores] = useState<
    Record<number, Array<{ h: string; a: string }>>
  >({});
  useEffect(() => {
    if (detail?.rubbers) {
      const next: Record<number, Array<{ h: string; a: string }>> = {};
      detail.rubbers.forEach((r) => {
        if (Array.isArray(r.setScores) && r.setScores.length) {
          next[r.id] = r.setScores.map((s) => ({
            h: String(s.h ?? ""),
            a: String(s.a ?? ""),
          }));
        } else if ((r.homeScore || 0) > 0 || (r.awayScore || 0) > 0) {
          next[r.id] = [
            { h: String(r.homeScore ?? ""), a: String(r.awayScore ?? "") },
          ];
        } else {
          next[r.id] = [{ h: "", a: "" }];
        }
      });
      setScores(next);
    }
  }, [detail?.id, detail?.rubbers?.length]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!detail) return { count: 0 };
      const tasks: Promise<any>[] = [];
      for (const r of detail.rubbers) {
        const sets = scores[r.id];
        if (!sets || !sets.length) continue;
        const cleanSets: { h: number; a: number }[] = [];
        for (const st of sets) {
          if (st.h === "" && st.a === "") continue;
          const h = Number(st.h);
          const a = Number(st.a);
          if (!Number.isFinite(h) || !Number.isFinite(a) || h < 0 || a < 0) {
            throw new Error(
              `Rubber R${r.rubberNumber}: every set score must be 0 or higher.`,
            );
          }
          cleanSets.push({ h, a });
        }
        if (!cleanSets.length) continue;
        // Cheap unchanged-check: only skip when both stored setScores and the
        // typed cleanSets match element-for-element.
        const stored = Array.isArray(r.setScores) ? r.setScores : null;
        const unchanged =
          stored &&
          stored.length === cleanSets.length &&
          stored.every(
            (s, i) =>
              (s.h ?? 0) === cleanSets[i].h && (s.a ?? 0) === cleanSets[i].a,
          );
        if (unchanged) continue;
        // Send setScores only — adding `status` would defeat the LIVE-day
        // "score-only" guard on PATCH /api/bsl/rubbers/:id. Backend marks the
        // rubber FINISHED automatically once setScores are saved.
        tasks.push(
          apiRequest("PATCH", `/api/bsl/rubbers/${r.id}`, {
            setScores: cleanSets,
          }),
        );
      }
      if (tasks.length === 0) return { count: 0 };
      await Promise.all(tasks);
      return { count: tasks.length };
    },
    onSuccess: (res) => {
      if (!res || res.count === 0) {
        toast({
          title: "No changes",
          description: "Nothing to save — scores match what's already stored.",
        });
        return;
      }
      toast({
        title: "Results saved",
        description: `${res.count} rubber${res.count === 1 ? "" : "s"} updated and standings refreshed.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/bsl/fixtures", selectedId],
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/standings"] });
    },
    onError: (err: any) => {
      toast({
        title: "Save failed",
        description: err?.message || "Could not save scores.",
        variant: "destructive",
      });
    },
  });

  // Aggregate everything the bottom summary needs in one pass over the live
  // (typed-but-unsaved) scores so the totals match what the user sees:
  //   - rubbers won per side  (existing behaviour)
  //   - points per pair (sum of set scores across all rubbers a pair played)
  //   - points per club (sum of all home-side and away-side set scores)
  // Pair stats key off bslTeamId so a pair playing multiple rubbers accumulates.
  const summary = useMemo(() => {
    const out = {
      h: 0,
      a: 0, // rubbers won (home, away)
      homePts: 0,
      awayPts: 0, // total points (sum of set scores) per side
      homeSets: 0,
      awaySets: 0, // sets won per side (totals across rubbers)
      pairs: new Map<
        number,
        {
          teamId: number;
          side: "home" | "away";
          name: string;
          points: number;
          setsWon: number;
          rubbersWon: number;
          rubbersPlayed: number;
        }
      >(),
    };
    if (!detail) return out;
    const homeClubName =
      (detail as any)?.homeClub?.name ||
      (detail as any)?.homeTeamName ||
      "Home";
    const awayClubName =
      (detail as any)?.awayClub?.name ||
      (detail as any)?.awayTeamName ||
      "Away";
    const stripClub = (name: string, clubName?: string) => {
      let s = name || "";
      if (clubName)
        s = s.replace(
          new RegExp(
            "^" + clubName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\s*",
            "i",
          ),
          "",
        );
      // Also strip any leading "<Anything> Division " prefix (e.g. "Social Division MD Pair B" → "MD Pair B").
      s = s.replace(/^.*?\bDivision\b\s*/i, "");
      return s.trim();
    };
    const ensurePair = (
      teamId: number | null | undefined,
      side: "home" | "away",
    ) => {
      if (!teamId) return null;
      let row = out.pairs.get(teamId);
      if (!row) {
        const src = side === "home" ? homePairs : awayPairs;
        const p = src.find((x) => x.id === teamId) as any;
        const club = side === "home" ? homeClubName : awayClubName;
        const short = p ? stripClub(p.name, club) || p.name : `Pair #${teamId}`;
        const names =
          p && Array.isArray(p.playerNames) && p.playerNames.length
            ? p.playerNames.join(" & ")
            : "";
        row = {
          teamId,
          side,
          name: names ? `${short} — ${names}` : short,
          points: 0,
          setsWon: 0,
          rubbersWon: 0,
          rubbersPlayed: 0,
        };
        out.pairs.set(teamId, row);
      }
      return row;
    };
    detail.rubbers.forEach((r) => {
      const typed = scores[r.id];
      // Use typed sets if present (live preview), else fall back to saved setScores, else single homeScore/awayScore
      let sets: Array<{ h: number; a: number }> = [];
      if (typed && typed.length) {
        for (const st of typed) {
          const sh = Number(st.h),
            sa = Number(st.a);
          if (!Number.isFinite(sh) || !Number.isFinite(sa)) continue;
          if (st.h === "" && st.a === "") continue;
          sets.push({ h: sh, a: sa });
        }
      } else if (Array.isArray(r.setScores) && r.setScores.length) {
        sets = r.setScores.map((s) => ({
          h: Number(s.h) || 0,
          a: Number(s.a) || 0,
        }));
      } else if ((r.homeScore || 0) > 0 || (r.awayScore || 0) > 0) {
        sets = [{ h: r.homeScore, a: r.awayScore }];
      }
      let hw = 0,
        aw = 0,
        hp = 0,
        ap = 0;
      for (const s of sets) {
        hp += s.h;
        ap += s.a;
        if (s.h > s.a) hw++;
        else if (s.a > s.h) aw++;
      }
      out.homePts += hp;
      out.awayPts += ap;
      out.homeSets += hw;
      out.awaySets += aw;
      const rubberWonBy: "h" | "a" | null =
        hw > aw ? "h" : aw > hw ? "a" : null;
      if (rubberWonBy === "h") out.h++;
      else if (rubberWonBy === "a") out.a++;
      const hPair = ensurePair(r.homeTeamId, "home");
      const aPair = ensurePair(r.awayTeamId, "away");
      if (hPair) {
        hPair.points += hp;
        hPair.setsWon += hw;
        hPair.rubbersPlayed++;
        if (rubberWonBy === "h") hPair.rubbersWon++;
      }
      if (aPair) {
        aPair.points += ap;
        aPair.setsWon += aw;
        aPair.rubbersPlayed++;
        if (rubberWonBy === "a") aPair.rubbersWon++;
      }
    });
    return out;
  }, [detail, scores, homePairs, awayPairs]);

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />

      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-6 md:pt-8 space-y-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin">
            <button
              className="inline-flex items-center gap-1.5 text-xs text-white/70 hover:text-white"
              data-testid="link-back-admin"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Admin
            </button>
          </Link>
        </div>

        <div
          className="rounded-2xl px-5 py-5 border"
          style={{
            borderColor: `${BSL.cyan}33`,
            background: `linear-gradient(135deg, ${BSL.cyan}14, ${BSL.gold}10)`,
          }}
          data-testid="quick-results-header"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center"
              style={{
                background: `${BSL.cyan}22`,
                border: `1px solid ${BSL.cyan}55`,
              }}
            >
              <ClipboardEdit className="h-5 w-5" style={{ color: BSL.cyan }} />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
                Quick Results Entry
              </h1>
              <p className="text-xs md:text-sm text-white/60">
                Pick a match, type every rubber score, hit save. That's it.
              </p>
            </div>
          </div>
        </div>

        {/* FIXTURE PICKER */}
        <div
          className="rounded-2xl border p-4 space-y-2"
          style={{
            borderColor: `${BSL.cyan}33`,
            background: "hsla(222,55%,4%,0.55)",
          }}
        >
          <label className="text-[10px] uppercase tracking-wider text-white/60 font-bold">
            Match
          </label>
          <select
            value={selectedId ?? ""}
            onChange={(e) => setSelectedId(Number(e.target.value))}
            className="w-full bg-black/40 border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2"
            style={{ borderColor: `${BSL.cyan}55` }}
            data-testid="select-fixture"
          >
            <option value="">— Select a match —</option>
            {fixtures.map((f) => {
              const when = f.startTime
                ? format(new Date(f.startTime), "d MMM HH:mm")
                : "TBD";
              const isDone = f.status === "FINISHED";
              return (
                <option key={f.id} value={f.id}>
                  {when} · {f.homeTeamName} vs {f.awayTeamName}
                  {f.category ? ` · ${f.category}` : ""}
                  {isDone ? "  ✓" : ""}
                </option>
              );
            })}
          </select>
        </div>

        {detailLoading && (
          <div className="text-center text-white/60 text-sm py-8">
            <Loader2 className="h-4 w-4 animate-spin inline mr-2" /> Loading…
          </div>
        )}

        {detail && (
          <div
            className="rounded-2xl border overflow-hidden"
            style={{
              borderColor: `${BSL.cyan}33`,
              background: "hsla(222,55%,4%,0.55)",
            }}
            data-testid="rubbers-card"
          >
            {/* Match header */}
            <div
              className="px-4 py-3 border-b flex items-center justify-between gap-3"
              style={{ borderColor: `${BSL.cyan}22` }}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  {detail.startTime
                    ? format(new Date(detail.startTime), "EEE d MMM · HH:mm")
                    : "No start time"}
                  {detail.category ? ` · ${detail.category}` : ""}
                </div>
                <div className="text-base font-extrabold truncate">
                  {detail.homeTeamName}{" "}
                  <span className="text-white/40">vs</span>{" "}
                  {detail.awayTeamName}
                </div>
              </div>
              <div className="text-right">
                <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                  Total points
                </div>
                <div
                  className="text-lg font-extrabold tabular-nums"
                  style={{ color: BSL.gold }}
                  data-testid="text-fixture-points"
                >
                  {summary.homePts}{" "}
                  <span className="text-white/40 font-medium">–</span>{" "}
                  {summary.awayPts}
                </div>
                <div
                  className="text-[10px] text-white/40 tabular-nums"
                  data-testid="text-fixture-sets-won"
                >
                  {summary.homeSets}–{summary.awaySets} sets · {summary.h}–
                  {summary.a} rubbers
                </div>
              </div>
            </div>

            {/* Rubbers table */}
            <div className="divide-y" style={{ borderColor: `${BSL.cyan}10` }}>
              {detail.rubbers.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-white/50">
                  No rubbers set up for this match yet. Open the match detail
                  page to add categories first.
                </div>
              ) : (
                detail.rubbers.map((r) => {
                  const sets = scores[r.id] || [{ h: "", a: "" }];
                  let hw = 0,
                    aw = 0;
                  for (const st of sets) {
                    const sh = Number(st.h),
                      sa = Number(st.a);
                    if (!Number.isFinite(sh) || !Number.isFinite(sa)) continue;
                    if (sh > sa) hw++;
                    else if (sa > sh) aw++;
                  }
                  const winner = hw > aw ? "h" : aw > hw ? "a" : null;
                  // Filter pair options by rubber type — doubles types lock to
                  // matching pair category (matches the server-side guard).
                  const isDoubles = ["MD", "WD", "XD"].includes(r.rubberType);
                  const homeOpts = isDoubles
                    ? homePairs.filter((p) => p.category === r.rubberType)
                    : homePairs;
                  const awayOpts = isDoubles
                    ? awayPairs.filter((p) => p.category === r.rubberType)
                    : awayPairs;
                  // Pairs MAY be allocated to multiple rubbers — no sibling
                  // conflict filtering here or on the server.
                  const homeSelected = homePairs.find(
                    (p) => p.id === r.homeTeamId,
                  ) as any;
                  const awaySelected = awayPairs.find(
                    (p) => p.id === r.awayTeamId,
                  ) as any;
                  const homeClubName =
                    (detail as any)?.homeClub?.name ||
                    (detail as any)?.homeClubName ||
                    (detail as any)?.homeTeamName ||
                    "";
                  const awayClubName =
                    (detail as any)?.awayClub?.name ||
                    (detail as any)?.awayClubName ||
                    (detail as any)?.awayTeamName ||
                    "";
                  const stripClub = (name: string, clubName?: string) => {
                    let s = name || "";
                    if (clubName)
                      s = s.replace(
                        new RegExp(
                          "^" +
                            clubName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
                            "\\s*",
                          "i",
                        ),
                        "",
                      );
                    s = s.replace(/^.*?\bDivision\b\s*/i, "");
                    return s.trim();
                  };
                  const fmtPair = (p: any, clubName?: string) => {
                    if (!p) return "—";
                    const short = stripClub(p.name, clubName) || p.name;
                    const names =
                      Array.isArray(p.playerNames) && p.playerNames.length
                        ? p.playerNames.join(" & ")
                        : "no players";
                    return `${short} · ${names}`;
                  };
                  return (
                    <div
                      key={r.id}
                      className="px-4 py-3 grid grid-cols-12 gap-2 items-center"
                      data-testid={`rubber-row-${r.id}`}
                    >
                      <div className="col-span-2">
                        <div className="text-[10px] uppercase tracking-wider text-white/50 font-bold">
                          R{r.rubberNumber}
                        </div>
                        <div className="text-xs font-bold text-white/80">
                          {r.rubberType}
                        </div>
                      </div>
                      <div
                        className="col-span-12 -mb-1 text-[11px] font-bold flex flex-wrap gap-x-2"
                        data-testid={`text-pair-summary-${r.id}`}
                      >
                        <span
                          className={
                            homeSelected ? "text-white" : "text-white/40"
                          }
                        >
                          {fmtPair(homeSelected, homeClubName)}
                        </span>
                        <span className="text-white/40">vs</span>
                        <span
                          className={
                            awaySelected ? "text-white" : "text-white/40"
                          }
                        >
                          {fmtPair(awaySelected, awayClubName)}
                        </span>
                      </div>
                      <div className="col-span-4 flex flex-col gap-1.5">
                        <select
                          value={r.homeTeamId ?? ""}
                          disabled={
                            assignMutation.isPending || homeClubId == null
                          }
                          onChange={(e) =>
                            assignMutation.mutate({
                              rubberId: r.id,
                              side: "home",
                              bslTeamId: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 text-white"
                          style={{
                            borderColor: `${BSL.cyan}33`,
                            colorScheme: "dark",
                          }}
                          data-testid={`select-rubber-home-pair-${r.id}`}
                        >
                          <option
                            value=""
                            style={{ background: BSL.card, color: "white" }}
                          >
                            — Pick home pair —
                          </option>
                          {homeOpts.map((p) => {
                            const names =
                              Array.isArray((p as any).playerNames) &&
                              (p as any).playerNames.length
                                ? (p as any).playerNames.join(" & ")
                                : "no players assigned";
                            const short =
                              stripClub(p.name, homeClubName) || p.name;
                            return (
                              <option
                                key={p.id}
                                value={p.id}
                                style={{ background: BSL.card, color: "white" }}
                              >
                                {short} — {names}
                              </option>
                            );
                          })}
                        </select>
                        <div className="space-y-1.5">
                          {sets.map((st, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <span className="text-[10px] font-bold w-6 text-white/40">
                                S{idx + 1}
                              </span>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={st.h}
                                onChange={(e) =>
                                  setScores((prev) => {
                                    const cur = (prev[r.id] || []).slice();
                                    cur[idx] = {
                                      ...(cur[idx] || { h: "", a: "" }),
                                      h: e.target.value,
                                    };
                                    return { ...prev, [r.id]: cur };
                                  })
                                }
                                className={`flex-1 bg-black/40 border rounded-lg px-2 py-1.5 text-center text-base font-extrabold tabular-nums focus:outline-none focus:ring-2 ${winner === "h" ? "ring-1" : ""}`}
                                style={{
                                  borderColor:
                                    winner === "h" ? BSL.gold : `${BSL.cyan}33`,
                                  color: winner === "h" ? BSL.gold : "white",
                                }}
                                data-testid={`input-rubber-home-set-${r.id}-${idx}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="col-span-2 text-center text-white/40 text-xs font-bold">
                        vs
                      </div>
                      <div className="col-span-4 flex flex-col gap-1.5">
                        <select
                          value={r.awayTeamId ?? ""}
                          disabled={
                            assignMutation.isPending || awayClubId == null
                          }
                          onChange={(e) =>
                            assignMutation.mutate({
                              rubberId: r.id,
                              side: "away",
                              bslTeamId: e.target.value
                                ? Number(e.target.value)
                                : null,
                            })
                          }
                          className="w-full bg-black/40 border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 text-white"
                          style={{
                            borderColor: `${BSL.cyan}33`,
                            colorScheme: "dark",
                          }}
                          data-testid={`select-rubber-away-pair-${r.id}`}
                        >
                          <option
                            value=""
                            style={{ background: BSL.card, color: "white" }}
                          >
                            — Pick away pair —
                          </option>
                          {awayOpts.map((p) => {
                            const names =
                              Array.isArray((p as any).playerNames) &&
                              (p as any).playerNames.length
                                ? (p as any).playerNames.join(" & ")
                                : "no players assigned";
                            const short =
                              stripClub(p.name, awayClubName) || p.name;
                            return (
                              <option
                                key={p.id}
                                value={p.id}
                                style={{ background: BSL.card, color: "white" }}
                              >
                                {short} — {names}
                              </option>
                            );
                          })}
                        </select>
                        <div className="space-y-1.5">
                          {sets.map((st, idx) => (
                            <div key={idx} className="flex items-center gap-1">
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={st.a}
                                onChange={(e) =>
                                  setScores((prev) => {
                                    const cur = (prev[r.id] || []).slice();
                                    cur[idx] = {
                                      ...(cur[idx] || { h: "", a: "" }),
                                      a: e.target.value,
                                    };
                                    return { ...prev, [r.id]: cur };
                                  })
                                }
                                className={`flex-1 bg-black/40 border rounded-lg px-2 py-1.5 text-center text-base font-extrabold tabular-nums focus:outline-none focus:ring-2 ${winner === "a" ? "ring-1" : ""}`}
                                style={{
                                  borderColor:
                                    winner === "a" ? BSL.gold : `${BSL.cyan}33`,
                                  color: winner === "a" ? BSL.gold : "white",
                                }}
                                data-testid={`input-rubber-away-set-${r.id}-${idx}`}
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setScores((prev) => {
                                    const cur = (prev[r.id] || []).slice();
                                    if (cur.length <= 1)
                                      return {
                                        ...prev,
                                        [r.id]: [{ h: "", a: "" }],
                                      };
                                    cur.splice(idx, 1);
                                    return { ...prev, [r.id]: cur };
                                  })
                                }
                                className="p-1 rounded text-white/40 hover:text-white/80"
                                title="Remove set"
                                data-testid={`button-remove-set-${r.id}-${idx}`}
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="col-span-12 flex items-center justify-between gap-2 -mt-1">
                        <button
                          type="button"
                          onClick={() =>
                            setScores((prev) => ({
                              ...prev,
                              [r.id]: [...(prev[r.id] || []), { h: "", a: "" }],
                            }))
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-bold"
                          style={{
                            background: `${BSL.cyan}22`,
                            color: BSL.cyan,
                            border: `1px dashed ${BSL.cyan}55`,
                          }}
                          data-testid={`button-add-set-${r.id}`}
                        >
                          <Plus className="h-3 w-3" /> Add set
                        </button>
                        <span className="text-[10px] font-bold tabular-nums text-white/60">
                          Sets won:{" "}
                          <span style={{ color: BSL.gold }}>{hw}</span> –{" "}
                          <span style={{ color: BSL.gold }}>{aw}</span>
                        </span>
                        <div className="inline-flex items-center gap-2">
                          <span className="text-[10px] text-white/40">
                            {r.status === "FINISHED" ? (
                              <span className="inline-flex items-center gap-1 text-emerald-400/80">
                                <CheckCircle2 className="h-3 w-3" /> Saved
                              </span>
                            ) : (
                              <span>Will be marked finished on save</span>
                            )}
                          </span>
                          <button
                            type="button"
                            disabled={deleteRubberMutation.isPending}
                            onClick={() => {
                              if (
                                window.confirm(
                                  `Remove rubber R${r.rubberNumber} (${r.rubberType})? This deletes its scores and updates the standings.`,
                                )
                              ) {
                                deleteRubberMutation.mutate(r.id);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-rose-300 hover:bg-rose-500/15 border border-rose-400/30 disabled:opacity-50"
                            title="Remove this rubber"
                            data-testid={`button-delete-rubber-${r.id}`}
                          >
                            <Trash2 className="h-3 w-3" /> Remove rubber
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* MATCH SUMMARY — points per pair + points per club. Always
                visible so admins can see the running tally as they type.
                Numbers update live from the editable scores; once "Save all"
                is clicked the same numbers feed standings + leaderboards. */}
            {detail.rubbers.length > 0 &&
              (() => {
                const homeClubName =
                  (detail as any)?.homeClub?.name ||
                  detail.homeTeamName ||
                  "Home";
                const awayClubName =
                  (detail as any)?.awayClub?.name ||
                  detail.awayTeamName ||
                  "Away";
                // Winner is decided by TOTAL POINTS (sum of every set score),
                // not rubbers or sets won — BSL is a points-based competition.
                const homeWonMatch = summary.homePts > summary.awayPts;
                const awayWonMatch = summary.awayPts > summary.homePts;
                const tied = summary.homePts === summary.awayPts;
                const homePairs = Array.from(summary.pairs.values())
                  .filter((p) => p.side === "home")
                  .sort((a, b) => b.points - a.points);
                const awayPairs = Array.from(summary.pairs.values())
                  .filter((p) => p.side === "away")
                  .sort((a, b) => b.points - a.points);
                const ClubBlock = ({
                  side,
                  name,
                  rubbersWon,
                  sets,
                  pts,
                  isWinner,
                  pairs,
                }: any) => (
                  <div
                    className="rounded-xl border p-3 space-y-2"
                    style={{
                      borderColor: isWinner ? BSL.gold : `${BSL.cyan}33`,
                      background: isWinner
                        ? `${BSL.gold}10`
                        : "hsla(222,55%,4%,0.55)",
                      boxShadow: isWinner ? `0 0 24px ${BSL.gold}33` : "none",
                    }}
                    data-testid={`summary-club-${side}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        {isWinner && (
                          <Trophy
                            className="h-3.5 w-3.5 flex-none"
                            style={{ color: BSL.gold }}
                          />
                        )}
                        <span
                          className="font-extrabold text-sm truncate"
                          style={{ color: isWinner ? BSL.gold : "white" }}
                          data-testid={`text-club-name-${side}`}
                        >
                          {name}
                        </span>
                      </div>
                      <span
                        className="text-[10px] uppercase tracking-wider font-bold"
                        style={{ color: isWinner ? BSL.gold : "white" }}
                      >
                        {isWinner ? "Winning" : "—"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-center">
                      <div className="rounded bg-black/30 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold">
                          Rubbers
                        </div>
                        <div
                          className="text-base font-extrabold tabular-nums"
                          data-testid={`text-club-rubbers-${side}`}
                        >
                          {rubbersWon}
                        </div>
                      </div>
                      <div className="rounded bg-black/30 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold">
                          Sets
                        </div>
                        <div
                          className="text-base font-extrabold tabular-nums"
                          data-testid={`text-club-sets-${side}`}
                        >
                          {sets}
                        </div>
                      </div>
                      <div className="rounded bg-black/30 py-1.5">
                        <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold">
                          Points
                        </div>
                        <div
                          className="text-base font-extrabold tabular-nums"
                          style={{ color: BSL.cyan }}
                          data-testid={`text-club-points-${side}`}
                        >
                          {pts}
                        </div>
                      </div>
                    </div>
                    {pairs.length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[9px] uppercase tracking-wider text-white/50 font-bold">
                          Pairs
                        </div>
                        {pairs.map((p: any) => (
                          <div
                            key={p.teamId}
                            className="flex items-center justify-between gap-2 text-[11px]"
                            data-testid={`row-pair-summary-${p.teamId}`}
                          >
                            <span className="truncate text-white/80">
                              {p.name}
                            </span>
                            <span className="flex items-center gap-2 tabular-nums font-bold">
                              <span className="text-white/50 text-[10px]">
                                {p.rubbersWon}/{p.rubbersPlayed} R
                              </span>
                              <span className="text-white/60 text-[10px]">
                                {p.setsWon} sets
                              </span>
                              <span
                                style={{ color: BSL.cyan }}
                                data-testid={`text-pair-points-${p.teamId}`}
                              >
                                {p.points} pts
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
                return (
                  <div
                    className="px-4 py-4 border-t space-y-3"
                    style={{ borderColor: `${BSL.cyan}22` }}
                    data-testid="match-summary"
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-white/60">
                        Match summary
                      </div>
                      <div className="text-[10px] text-white/40">
                        Winner = club with more total points
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <ClubBlock
                        side="home"
                        name={homeClubName}
                        rubbersWon={summary.h}
                        sets={summary.homeSets}
                        pts={summary.homePts}
                        isWinner={homeWonMatch}
                        pairs={homePairs}
                      />
                      <ClubBlock
                        side="away"
                        name={awayClubName}
                        rubbersWon={summary.a}
                        sets={summary.awaySets}
                        pts={summary.awayPts}
                        isWinner={awayWonMatch}
                        pairs={awayPairs}
                      />
                    </div>
                    <div
                      className="text-center text-[11px] font-bold"
                      style={{ color: tied ? "white" : BSL.gold }}
                      data-testid="text-match-winner"
                    >
                      {tied
                        ? `Tied — ${summary.homePts} pts each. Add scores or rubbers to decide.`
                        : `${homeWonMatch ? homeClubName : awayClubName} winning · ${Math.max(summary.homePts, summary.awayPts)} pts vs ${Math.min(summary.homePts, summary.awayPts)} pts`}
                    </div>
                  </div>
                );
              })()}

            <div
              className="px-4 py-3 border-t flex items-center justify-between gap-2 flex-wrap"
              style={{ borderColor: `${BSL.cyan}22` }}
            >
              {/* ADD RUBBER — available on any club-vs-club fixture regardless
                  of status. Server allows it; standings recompute on save. */}
              {homeClubId != null && awayClubId != null ? (
                <div className="flex items-center gap-2">
                  <select
                    value={newRubberType}
                    onChange={(e) =>
                      setNewRubberType(
                        e.target.value as (typeof RUBBER_TYPES)[number],
                      )
                    }
                    className="bg-black/40 border rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-2"
                    style={{ borderColor: `${BSL.cyan}33` }}
                    data-testid="select-new-rubber-type"
                  >
                    {RUBBER_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={addRubberMutation.isPending}
                    onClick={() => addRubberMutation.mutate(newRubberType)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs disabled:opacity-50"
                    style={{
                      background: `${BSL.cyan}22`,
                      color: BSL.cyan,
                      border: `1px solid ${BSL.cyan}55`,
                    }}
                    data-testid="button-add-rubber"
                  >
                    {addRubberMutation.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                    Add rubber
                  </button>
                </div>
              ) : (
                <div />
              )}
              {detail.rubbers.length > 0 && (
                <button
                  type="button"
                  disabled={saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm disabled:opacity-50"
                  style={{ background: BSL.gold, color: BSL.bgDeep }}
                  data-testid="button-save-all"
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save all scores
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
