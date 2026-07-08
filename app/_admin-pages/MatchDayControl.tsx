import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "@/lib/routing";
import {
  Radio,
  Play,
  Pause,
  Square,
  Clock,
  Move,
  AlertCircle,
  ExternalLink,
  X,
  Trophy,
  Trash2,
  Archive,
  Plus,
  Minus,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const STATUS_TONE: any = {
  SCHEDULED: { c: BSL.muted, label: "Waiting" },
  WARMUP: { c: BSL.gold, label: "Warm-up" },
  LIVE: { c: BSL.cyan, label: "LIVE" },
  FINISHED: { c: BSL.success, label: "Completed" },
};

const RUBBER_TYPES = ["MS1", "MS2", "WS", "MD", "WD", "XD"] as const;

export default function MatchDayControl() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const { data: fixtures } = useQuery<any[]>({
    queryKey: ["/api/bsl/fixtures"],
    refetchInterval: 8000,
  });
  const { data: teams } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/clubs"],
  });
  const courtCount = league?.courtCount || 6;
  const [draggingId, setDraggingId] = useState<number | null>(null);
  const [finishingId, setFinishingId] = useState<number | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);

  const teamMap = useMemo(() => {
    const m = new Map<number, any>();
    (teams || []).forEach((c: any) => m.set(c.id, c));
    return m;
  }, [teams]);

  const updateFixture = useMutation({
    mutationFn: async (v: { id: number; data: any }) =>
      (await apiRequest("PATCH", `/api/bsl/fixtures/${v.id}`, v.data)).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] }),
  });
  const setStatus = useMutation({
    mutationFn: async (v: { id: number; status: string }) =>
      (
        await apiRequest("PATCH", `/api/bsl/admin/fixtures/${v.id}/status`, {
          status: v.status,
        })
      ).json(),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
      toast({ title: `Match → ${v.status}` });
    },
  });
  const setCourtCount = useMutation({
    mutationFn: async (n: number) =>
      (await apiRequest("PATCH", `/api/bsl/league`, { courtCount: n })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/league"] });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't change court count",
        description: e.message,
        variant: "destructive",
      }),
  });

  // END now opens the score-entry dialog instead of skipping straight to
  // FINISHED. The dialog itself flips status to FINISHED once scores are saved.
  const onEnd = (id: number) => setFinishingId(id);

  // Two-phase delete: try without force; if backend says force required (FINISHED
  // or any raw rubber score), reconfirm and retry. Backend is source of truth on
  // what counts as "scored" — aggregate fixture counters can lag raw rubber edits.
  const onDelete = async (f: any) => {
    const homeName =
      f.homeClubName || f.homeTeamName || `Team #${f.homeTeamId}`;
    const awayName =
      f.awayClubName || f.awayTeamName || `Team #${f.awayTeamId}`;
    if (!confirm(`Delete fixture: ${homeName} vs ${awayName}?`)) return;
    const tryDelete = async (force: boolean) => {
      const r = await fetch(
        `/api/bsl/admin/fixtures/${f.id}${force ? "?force=true" : ""}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      return {
        ok: r.ok,
        status: r.status,
        body: await r.json().catch(() => ({})),
      };
    };
    let resp = await tryDelete(false);
    if (
      !resp.ok &&
      resp.status === 400 &&
      /force=true/i.test(resp.body?.message || "")
    ) {
      if (!confirm(`${resp.body.message}\n\nDelete anyway?`)) return;
      resp = await tryDelete(true);
    }
    if (!resp.ok) {
      toast({
        title: "Couldn't delete",
        description: (resp.body?.message || `HTTP ${resp.status}`).replace(
          /^\d+:\s*/,
          "",
        ),
        variant: "destructive",
      });
      return;
    }
    qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/standings"] });
    toast({ title: "Fixture deleted" });
  };

  // Active fixtures = anything not FINISHED. Archive = FINISHED (regardless of court).
  const activeFixtures = (fixtures || []).filter(
    (f: any) => f.status !== "FINISHED",
  );
  const archived = (fixtures || []).filter((f: any) => f.status === "FINISHED");
  const unassigned = activeFixtures.filter((f: any) => f.court == null);
  const courts = Array.from({ length: courtCount }, (_, i) => i + 1);

  const onDragStart = (id: number) => setDraggingId(id);
  const onDrop = (court: number | null) => {
    if (draggingId == null) return;
    updateFixture.mutate({ id: draggingId, data: { court } });
    setDraggingId(null);
  };
  // Drop into archive zone — mark fixture FINISHED.
  const onDropToArchive = () => {
    if (draggingId == null) return;
    const f = (fixtures || []).find((x: any) => x.id === draggingId);
    if (!f) {
      setDraggingId(null);
      return;
    }
    if (f.status === "FINISHED") {
      setDraggingId(null);
      return;
    }
    if (
      !confirm(
        "Archive this match? It will be marked as FINISHED and updates the standings.",
      )
    ) {
      setDraggingId(null);
      return;
    }
    setStatus.mutate({ id: draggingId, status: "FINISHED" });
    setDraggingId(null);
  };

  const incCourts = () => setCourtCount.mutate(Math.min(courtCount + 1, 32));
  const decCourts = () => {
    const next = Math.max(1, courtCount - 1);
    // Warn if we'd hide an assigned fixture (it stays in DB, just visually disappears).
    const orphaned = (fixtures || []).filter(
      (f: any) => f.court != null && f.court > next && f.status !== "FINISHED",
    );
    if (
      orphaned.length > 0 &&
      !confirm(
        `${orphaned.length} active fixture(s) are assigned to court ${next + 1}+. They'll be hidden from the grid until you re-add a court or unassign them. Continue?`,
      )
    )
      return;
    setCourtCount.mutate(next);
  };

  return (
    <AdminLayout active="match-day">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            Match Day <span style={{ color: BSL.cyan }}>Control</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: BSL.muted }}>
            Drag fixtures onto courts · start/pause/end live · scores via match
            detail
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs flex-wrap">
          {Object.entries(STATUS_TONE).map(([k, v]: any) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: v.c, boxShadow: `0 0 8px ${v.c}` }}
              />
              {v.label}
            </span>
          ))}
          {/* Court counter — inline +/- to add/remove courts without leaving the page. */}
          <div
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
            }}
            data-testid="court-counter"
          >
            <span
              className="text-[10px] uppercase tracking-widest font-bold mr-1"
              style={{ color: BSL.muted }}
            >
              Courts
            </span>
            <button
              onClick={decCourts}
              disabled={setCourtCount.isPending || courtCount <= 1}
              className="h-6 w-6 rounded-md inline-flex items-center justify-center disabled:opacity-40"
              style={{
                background: `${BSL.danger}22`,
                color: BSL.danger,
                border: `1px solid ${BSL.danger}55`,
              }}
              title="Remove a court"
              data-testid="button-remove-court"
            >
              <Minus className="h-3 w-3" />
            </button>
            <span
              className="px-2 font-black tabular-nums text-sm"
              style={{ color: BSL.gold }}
              data-testid="text-court-count"
            >
              {courtCount}
            </span>
            <button
              onClick={incCourts}
              disabled={setCourtCount.isPending || courtCount >= 32}
              className="h-6 w-6 rounded-md inline-flex items-center justify-center disabled:opacity-40"
              style={{
                background: `${BSL.cyan}22`,
                color: BSL.cyan,
                border: `1px solid ${BSL.cyan}55`,
              }}
              title="Add a court"
              data-testid="button-add-court"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      {/* === COURT GRID === */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {courts.map((court) => {
          const here = activeFixtures.filter((f: any) => f.court === court);
          return (
            <div
              key={court}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => onDrop(court)}
              className="rounded-2xl p-4 min-h-[180px] transition-all"
              style={{
                background: draggingId
                  ? `linear-gradient(135deg, ${BSL.cyan}11, ${BSL.card})`
                  : BSL.card,
                border: `1px solid ${draggingId ? BSL.cyan : BSL.border}`,
                boxShadow: draggingId
                  ? `0 0 24px ${BSL.cyan}33`
                  : `0 4px 16px hsla(222,60%,2%,0.4)`,
              }}
              data-testid={`court-${court}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span
                  className="text-[10px] uppercase tracking-widest font-bold"
                  style={{ color: BSL.muted }}
                >
                  Court
                </span>
                <span
                  className="text-2xl font-black"
                  style={{ color: BSL.gold }}
                >
                  #{court}
                </span>
              </div>
              <AnimatePresence>
                {here.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="py-6 text-center text-xs border-2 border-dashed rounded-xl"
                    style={{ borderColor: BSL.border, color: BSL.faint }}
                  >
                    Drop a fixture here
                  </motion.div>
                )}
                {here.map((f: any) => (
                  <MatchTile
                    key={f.id}
                    f={f}
                    teamMap={teamMap}
                    onSetStatus={(s) =>
                      setStatus.mutate({ id: f.id, status: s })
                    }
                    onEnd={() => onEnd(f.id)}
                    onDelete={() => onDelete(f)}
                    onUnassign={() =>
                      updateFixture.mutate({ id: f.id, data: { court: null } })
                    }
                    onDragStart={() => onDragStart(f.id)}
                  />
                ))}
              </AnimatePresence>
            </div>
          );
        })}
      </div>

      {/* === UNASSIGNED POOL === */}
      <GlowPanel
        title="Unassigned Fixtures"
        subtitle={`${unassigned.length} pending court allocation`}
        tone="cyan"
        icon={<Move className="h-4 w-4" />}
      >
        {unassigned.length === 0 ? (
          <div
            className="py-6 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            All fixtures assigned to courts. ⚡
          </div>
        ) : (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => onDrop(null)}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
          >
            {unassigned.map((f: any) => (
              <MatchTile
                key={f.id}
                f={f}
                teamMap={teamMap}
                onSetStatus={(s) => setStatus.mutate({ id: f.id, status: s })}
                onEnd={() => onEnd(f.id)}
                onDelete={() => onDelete(f)}
                onUnassign={null}
                onDragStart={() => onDragStart(f.id)}
              />
            ))}
          </div>
        )}
      </GlowPanel>

      {/* === ARCHIVE — finished matches live here. Drag any active match in to mark it FINISHED. === */}
      <div className="mt-6">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDropToArchive}
          className="rounded-2xl p-4 transition-all"
          style={{
            background: draggingId
              ? `linear-gradient(135deg, ${BSL.success}11, ${BSL.card})`
              : BSL.card,
            border: `1px solid ${draggingId ? BSL.success : BSL.border}`,
            boxShadow: draggingId
              ? `0 0 24px ${BSL.success}33`
              : `0 4px 16px hsla(222,60%,2%,0.4)`,
          }}
          data-testid="archive-zone"
        >
          <button
            onClick={() => setArchiveOpen((o) => !o)}
            className="w-full flex items-center justify-between mb-2"
            data-testid="button-toggle-archive"
          >
            <div className="flex items-center gap-2">
              <Archive className="h-4 w-4" style={{ color: BSL.success }} />
              <span
                className="text-sm font-black uppercase tracking-widest"
                style={{ color: BSL.success }}
              >
                Archive · Finished Matches
              </span>
              <span
                className="text-xs font-bold tabular-nums px-2 py-0.5 rounded-md"
                style={{ background: `${BSL.success}22`, color: BSL.success }}
                data-testid="text-archive-count"
              >
                {archived.length}
              </span>
            </div>
            <span
              className="text-[10px] uppercase tracking-widest font-bold"
              style={{ color: BSL.muted }}
            >
              {draggingId
                ? "Drop here to archive"
                : archiveOpen
                  ? "Hide"
                  : "Show"}
            </span>
          </button>
          {archived.length === 0 && (
            <div
              className="py-4 text-center text-xs border-2 border-dashed rounded-xl"
              style={{ borderColor: BSL.border, color: BSL.faint }}
            >
              No finished matches yet — drag a match here to archive it.
            </div>
          )}
          {archiveOpen && archived.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
              {archived.map((f: any) => (
                <MatchTile
                  key={f.id}
                  f={f}
                  teamMap={teamMap}
                  onSetStatus={(s) => setStatus.mutate({ id: f.id, status: s })}
                  onEnd={() => onEnd(f.id)}
                  onDelete={() => onDelete(f)}
                  onUnassign={null}
                  onDragStart={() => onDragStart(f.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <AnimatePresence>
        {finishingId != null && (
          <FinishMatchDialog
            fixtureId={finishingId}
            teamMap={teamMap}
            onClose={() => setFinishingId(null)}
            onFinished={() => {
              qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
              qc.invalidateQueries({ queryKey: ["/api/bsl/standings"] });
              setFinishingId(null);
            }}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}

function MatchTile({
  f,
  teamMap,
  onSetStatus,
  onEnd,
  onDelete,
  onUnassign,
  onDragStart,
}: any) {
  const home = { name: f.homeTeamName || teamMap.get(f.homeTeamId)?.name };
  const away = { name: f.awayTeamName || teamMap.get(f.awayTeamId)?.name };
  const tone = STATUS_TONE[f.status] || STATUS_TONE.SCHEDULED;
  const isFinished = f.status === "FINISHED";
  return (
    <motion.div
      layout
      draggable
      onDragStart={onDragStart}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ y: -2 }}
      className="rounded-xl p-3 cursor-grab active:cursor-grabbing select-none"
      style={{
        background: BSL.cardSoft,
        border: `1px solid ${tone.c}55`,
        opacity: isFinished ? 0.85 : 1,
      }}
      data-testid={`tile-fixture-${f.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded"
          style={{ background: `${tone.c}22`, color: tone.c }}
        >
          {f.status === "LIVE" && (
            <span
              className="inline-block h-1.5 w-1.5 rounded-full mr-1 animate-pulse"
              style={{ background: tone.c }}
            />
          )}
          {tone.label}
        </span>
        <Link href={`/match/${f.id}`}>
          <a
            className="p-1 rounded"
            style={{ color: BSL.muted }}
            data-testid={`button-open-fixture-${f.id}`}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </Link>
      </div>
      <div className="flex items-center justify-between font-bold text-sm">
        <span className="truncate flex-1">
          {home?.name || `Team #${f.homeTeamId}`}
        </span>
        <span className="px-2 tabular-nums" style={{ color: BSL.gold }}>
          {f.homeRubbers} – {f.awayRubbers}
        </span>
        <span className="truncate flex-1 text-right">
          {away?.name || `Team #${f.awayTeamId}`}
        </span>
      </div>
      <div className="flex items-center gap-1 mt-3">
        {!isFinished && (
          <>
            <ActionButton
              variant="cyan"
              onClick={() => onSetStatus("WARMUP")}
              icon={<Clock className="h-3 w-3" />}
            >
              Warm-up
            </ActionButton>
            <ActionButton
              variant="gold"
              onClick={() => onSetStatus("LIVE")}
              icon={<Play className="h-3 w-3" />}
            >
              Start
            </ActionButton>
            <ActionButton
              variant="danger"
              onClick={() => (onEnd ? onEnd() : onSetStatus("FINISHED"))}
              icon={<Square className="h-3 w-3" />}
            >
              End
            </ActionButton>
          </>
        )}
        {isFinished && (
          <ActionButton
            variant="cyan"
            onClick={() => onSetStatus("LIVE")}
            icon={<Play className="h-3 w-3" />}
            testid={`button-reopen-${f.id}`}
          >
            Re-open
          </ActionButton>
        )}
        <div className="ml-auto flex items-center gap-1">
          {onUnassign && (
            <button
              onClick={onUnassign}
              title="Unassign from court"
              className="p-1.5 rounded-md text-[10px]"
              style={{ background: `${BSL.muted}22`, color: BSL.muted }}
              data-testid={`button-unassign-${f.id}`}
            >
              <AlertCircle className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              title="Delete fixture"
              className="p-1.5 rounded-md"
              style={{
                background: `${BSL.danger}22`,
                color: BSL.danger,
                border: `1px solid ${BSL.danger}55`,
              }}
              data-testid={`button-delete-fixture-tile-${f.id}`}
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// FINISH MATCH DIALOG — enter rubber scores, save all, mark fixture FINISHED.
// Backend recomputeStandings() then re-tallies the league table automatically.
// Also lets admin add MORE rubbers inline (POST /api/bsl/admin/fixtures/:id/add-rubber).
// ---------------------------------------------------------------------------
function FinishMatchDialog({ fixtureId, teamMap, onClose, onFinished }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const {
    data: fixture,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<any>({
    queryKey: ["/api/bsl/fixtures", fixtureId],
    queryFn: async () => {
      const r = await fetch(`/api/bsl/fixtures/${fixtureId}`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(`Failed to load fixture (${r.status})`);
      return r.json();
    },
    retry: false,
  });

  // Local edits keyed by rubber id → array of { h, a } sets (strings, blanks allowed).
  // Multi-set entry: each rubber can have any number of sets; the winner of
  // each set is the side with the higher score. Rubber winner = side with more
  // sets won. Server stores both setScores and derived sets-won totals.
  const [scores, setScores] = useState<
    Record<number, Array<{ h: string; a: string }>>
  >({});
  const [saving, setSaving] = useState(false);
  const [newRubberType, setNewRubberType] =
    useState<(typeof RUBBER_TYPES)[number]>("MD");
  const [addingRubber, setAddingRubber] = useState(false);

  // Pair pickers — pull each club's existing bsl_teams so the admin can pick
  // which pair actually played each rubber. Backend at PATCH
  // /api/bsl/admin/rubbers/:id/assign enforces category match + sibling
  // uniqueness; we mirror the same filter here so the dropdown stays sane.
  const homeClubIdForPairs =
    fixture?.homeClub?.id ?? fixture?.homeClubId ?? null;
  const awayClubIdForPairs =
    fixture?.awayClub?.id ?? fixture?.awayClubId ?? null;
  const { data: homePairs = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/clubs", homeClubIdForPairs, "teams"],
    enabled: homeClubIdForPairs != null,
    queryFn: async () => {
      const r = await fetch(`/api/bsl/clubs/${homeClubIdForPairs}/teams`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
  const { data: awayPairs = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/clubs", awayClubIdForPairs, "teams"],
    enabled: awayClubIdForPairs != null,
    queryFn: async () => {
      const r = await fetch(`/api/bsl/clubs/${awayClubIdForPairs}/teams`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
  const [assigningRubberId, setAssigningRubberId] = useState<number | null>(
    null,
  );
  async function handleAssignPair(
    rubberId: number,
    side: "home" | "away",
    bslTeamId: number | null,
  ) {
    setAssigningRubberId(rubberId);
    try {
      const resp = await apiRequest(
        "PATCH",
        `/api/bsl/admin/rubbers/${rubberId}/assign`,
        { side, bslTeamId },
      );
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.message || `HTTP ${resp.status}`);
      }
      await refetch();
    } catch (err: any) {
      toast({
        title: "Pair assignment failed",
        description: (err.message || "").replace(/^\d+:\s*/, ""),
        variant: "destructive",
      });
    } finally {
      setAssigningRubberId(null);
    }
  }

  useEffect(() => {
    if (!fixture?.rubbers) return;
    // Preserve any unsaved edits the admin already typed for existing rubbers
    // when new rubbers are appended via add-rubber.
    setScores((prev) => {
      const next: Record<number, Array<{ h: string; a: string }>> = { ...prev };
      fixture.rubbers.forEach((r: any) => {
        if (!next[r.id]) {
          if (Array.isArray(r.setScores) && r.setScores.length) {
            next[r.id] = r.setScores.map((s: any) => ({
              h: String(s.h ?? ""),
              a: String(s.a ?? ""),
            }));
          } else if ((r.homeScore || 0) > 0 || (r.awayScore || 0) > 0) {
            // Back-compat: synthesise a single set from the legacy scalar score.
            next[r.id] = [
              { h: String(r.homeScore ?? ""), a: String(r.awayScore ?? "") },
            ];
          } else {
            next[r.id] = [{ h: "", a: "" }];
          }
        }
      });
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fixture?.id, fixture?.rubbers?.length]);

  const homeName =
    fixture?.homeClub?.name ||
    fixture?.homeTeamName ||
    teamMap?.get(fixture?.homeTeamId)?.name ||
    "Home";
  const awayName =
    fixture?.awayClub?.name ||
    fixture?.awayTeamName ||
    teamMap?.get(fixture?.awayTeamId)?.name ||
    "Away";

  // Live preview of the rubber tally as the admin types.
  const tally = (fixture?.rubbers || []).reduce(
    (acc: any, r: any) => {
      const sets = scores[r.id];
      if (!sets || !sets.length) return acc;
      let hw = 0,
        aw = 0;
      for (const st of sets) {
        const h = Number(st.h);
        const a = Number(st.a);
        if (!Number.isFinite(h) || !Number.isFinite(a)) continue;
        if (h > a) hw++;
        else if (a > h) aw++;
      }
      if (hw > aw) acc.home++;
      else if (aw > hw) acc.away++;
      return acc;
    },
    { home: 0, away: 0 },
  );

  async function handleAddRubber() {
    if (!fixtureId) return;
    setAddingRubber(true);
    try {
      const resp = await apiRequest(
        "POST",
        `/api/bsl/admin/fixtures/${fixtureId}/add-rubber`,
        { rubberType: newRubberType },
      );
      if (!resp.ok) {
        const t = await resp.text();
        throw new Error(t || "Failed to add rubber");
      }
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
      toast({ title: `Added rubber (${newRubberType})` });
    } catch (err: any) {
      const base = err?.message?.replace(/^\d+:\s*/, "") || "Unknown error";
      toast({
        title: "Couldn't add rubber",
        description: base,
        variant: "destructive",
      });
    } finally {
      setAddingRubber(false);
    }
  }

  async function handleDeleteRubber(rubberId: number) {
    if (!confirm("Delete this rubber? Any scores entered for it will be lost."))
      return;
    try {
      const resp = await fetch(
        `/api/bsl/admin/rubbers/${rubberId}?force=true`,
        { method: "DELETE", credentials: "include" },
      );
      const body = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(body?.message || `HTTP ${resp.status}`);
      setScores((p) => {
        const n = { ...p };
        delete n[rubberId];
        return n;
      });
      await refetch();
      qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
      toast({ title: "Rubber removed" });
    } catch (err: any) {
      toast({
        title: "Couldn't remove rubber",
        description: (err.message || "").replace(/^\d+:\s*/, ""),
        variant: "destructive",
      });
    }
  }

  async function handleSave() {
    if (isError) {
      toast({
        title: "Match didn't load",
        description: "Try again or close the dialog.",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    let savedAny = false;
    let savedFailed = false;
    try {
      // Save every rubber whose set list has at least one fully-typed set.
      // PATCH /api/bsl/rubbers/:id is allowed while the league day is LIVE
      // (lifecycle guard).
      for (const r of fixture?.rubbers || []) {
        const sets = scores[r.id];
        if (!sets || !sets.length) continue;
        const cleanSets: { h: number; a: number }[] = [];
        for (const st of sets) {
          if (st.h === "" && st.a === "") continue;
          const h = Number(st.h);
          const a = Number(st.a);
          if (!Number.isFinite(h) || !Number.isFinite(a) || h < 0 || a < 0) {
            throw new Error(
              `Rubber ${r.rubberNumber}: every set score must be 0 or higher.`,
            );
          }
          cleanSets.push({ h, a });
        }
        if (!cleanSets.length) continue;
        const resp = await apiRequest("PATCH", `/api/bsl/rubbers/${r.id}`, {
          setScores: cleanSets,
        });
        if (!resp.ok) {
          const t = await resp.text();
          savedFailed = true;
          throw new Error(t || `Failed to save rubber ${r.rubberNumber}`);
        }
        savedAny = true;
      }
      // Mark the fixture FINISHED — backend triggers recomputeStandings().
      // Allowed even with zero rubbers (e.g. walkover or rubber-less fixtures).
      const finishResp = await apiRequest(
        "PATCH",
        `/api/bsl/admin/fixtures/${fixtureId}/status`,
        { status: "FINISHED" },
      );
      if (!finishResp.ok) {
        const t = await finishResp.text();
        throw new Error(t || "Failed to finish match");
      }
      toast({
        title: "Match finished",
        description: `${homeName} ${tally.home} – ${tally.away} ${awayName} · standings updated`,
      });
      onFinished();
    } catch (err: any) {
      const base = err?.message?.replace(/^\d+:\s*/, "") || "Unknown error";
      // If we got partway through saving rubbers but then hit a failure, let
      // the admin know the partial state — the fixture is NOT marked FINISHED.
      const desc =
        savedAny && savedFailed
          ? `${base} — some rubbers saved; match not finished. Fix the failing rubber and try again.`
          : base;
      toast({
        title: "Could not save",
        description: desc,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "hsla(222,60%,2%,0.85)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
      data-testid="dialog-finish-match"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="w-full max-w-2xl rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
        style={{
          background: BSL.card,
          border: `1px solid ${BSL.cyan}55`,
          boxShadow: `0 24px 64px hsla(222,80%,2%,0.6), 0 0 0 1px ${BSL.cyan}22`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black uppercase tracking-tight inline-flex items-center gap-2">
            <Trophy className="h-5 w-5" style={{ color: BSL.gold }} />
            Finish match · <span style={{ color: BSL.cyan }}>enter scores</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded"
            style={{ background: BSL.cardSoft }}
            data-testid="button-close-finish"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div
          className="rounded-xl p-3 mb-4 flex items-center justify-between"
          style={{
            background: BSL.cardSoft,
            border: `1px solid ${BSL.border}`,
          }}
        >
          <div className="font-bold text-sm truncate flex-1">{homeName}</div>
          <div
            className="px-3 text-2xl font-black tabular-nums"
            style={{ color: BSL.gold }}
          >
            {tally.home} – {tally.away}
          </div>
          <div className="font-bold text-sm truncate flex-1 text-right">
            {awayName}
          </div>
        </div>

        {isLoading ? (
          <div
            className="py-8 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            Loading rubbers…
          </div>
        ) : isError ? (
          <div
            className="py-8 text-center space-y-3"
            data-testid="state-finish-load-error"
          >
            <div className="text-sm" style={{ color: BSL.danger || BSL.muted }}>
              Couldn't load this match. {(error as any)?.message || ""}
            </div>
            <button
              onClick={() => refetch()}
              className="text-xs underline font-bold"
              style={{ color: BSL.cyan }}
              data-testid="button-retry-finish-load"
            >
              Try again
            </button>
          </div>
        ) : !fixture?.rubbers?.length ? (
          <div
            className="py-8 text-center text-sm"
            style={{ color: BSL.muted }}
            data-testid="state-finish-no-rubbers"
          >
            This match has no rubbers set up. Add one below, or use{" "}
            <strong>Save scores + finish</strong> to mark it complete without
            per-rubber scores (e.g. walkover).
          </div>
        ) : (
          <div className="space-y-2">
            {fixture.rubbers.map((r: any) => {
              const sets = scores[r.id] || [{ h: "", a: "" }];
              const setSummary = sets.reduce(
                (acc, st) => {
                  const h = Number(st.h);
                  const a = Number(st.a);
                  if (!Number.isFinite(h) || !Number.isFinite(a)) return acc;
                  if (h > a) acc.h++;
                  else if (a > h) acc.a++;
                  return acc;
                },
                { h: 0, a: 0 },
              );
              const isDoubles = ["MD", "WD", "XD"].includes(r.rubberType);
              const homeOpts = isDoubles
                ? homePairs.filter((p: any) => p.category === r.rubberType)
                : homePairs;
              const awayOpts = isDoubles
                ? awayPairs.filter((p: any) => p.category === r.rubberType)
                : awayPairs;
              const pairsDisabled = assigningRubberId === r.id;
              // Resolve currently-selected pair (so we can show its players
              // on the row even after the dropdown closes / its label truncates).
              const homeSelected = homePairs.find(
                (p: any) => p.id === r.homeTeamId,
              );
              const awaySelected = awayPairs.find(
                (p: any) => p.id === r.awayTeamId,
              );
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
                // Also strip any leading "<Anything> Division " prefix.
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
                  className="rounded-lg p-2 space-y-1.5"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                  }}
                  data-testid={`row-rubber-${r.id}`}
                >
                  {/* Header: rubber number + type + currently-playing pairs */}
                  <div className="flex items-center gap-2 px-1 flex-wrap">
                    <span
                      className="text-xs font-black"
                      style={{ color: BSL.gold }}
                    >
                      #{r.rubberNumber}
                    </span>
                    <span
                      className="text-xs font-bold uppercase tracking-wider"
                      style={{ color: BSL.muted }}
                    >
                      {r.rubberType}
                    </span>
                    <span
                      className="text-[11px] font-bold ml-auto"
                      data-testid={`text-pair-summary-${r.id}`}
                    >
                      <span
                        style={{ color: homeSelected ? "white" : BSL.muted }}
                      >
                        {fmtPair(homeSelected, homeName)}
                      </span>
                      <span className="mx-1.5" style={{ color: BSL.muted }}>
                        vs
                      </span>
                      <span
                        style={{ color: awaySelected ? "white" : BSL.muted }}
                      >
                        {fmtPair(awaySelected, awayName)}
                      </span>
                    </span>
                  </div>
                  {/* Pair pickers row — only when we know the club ids */}
                  {homeClubIdForPairs != null && awayClubIdForPairs != null && (
                    <div className="grid grid-cols-[1fr_20px_1fr] items-center gap-2">
                      <select
                        value={r.homeTeamId ?? ""}
                        disabled={pairsDisabled}
                        onChange={(e) =>
                          handleAssignPair(
                            r.id,
                            "home",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-md text-xs font-bold"
                        style={{
                          background: BSL.card,
                          border: `1px solid ${BSL.border}`,
                          color: "white",
                          colorScheme: "dark",
                        }}
                        data-testid={`select-home-pair-${r.id}`}
                      >
                        <option
                          value=""
                          style={{ background: BSL.card, color: "white" }}
                        >
                          — Pick home pair —
                        </option>
                        {homeOpts.map((p: any) => {
                          const names =
                            Array.isArray(p.playerNames) && p.playerNames.length
                              ? p.playerNames.join(" & ")
                              : "no players assigned";
                          const short = stripClub(p.name, homeName) || p.name;
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
                      <span
                        className="text-center text-[10px] font-bold"
                        style={{ color: BSL.muted }}
                      >
                        vs
                      </span>
                      <select
                        value={r.awayTeamId ?? ""}
                        disabled={pairsDisabled}
                        onChange={(e) =>
                          handleAssignPair(
                            r.id,
                            "away",
                            e.target.value ? Number(e.target.value) : null,
                          )
                        }
                        className="w-full px-2 py-1.5 rounded-md text-xs font-bold"
                        style={{
                          background: BSL.card,
                          border: `1px solid ${BSL.border}`,
                          color: "white",
                          colorScheme: "dark",
                        }}
                        data-testid={`select-away-pair-${r.id}`}
                      >
                        <option
                          value=""
                          style={{ background: BSL.card, color: "white" }}
                        >
                          — Pick away pair —
                        </option>
                        {awayOpts.map((p: any) => {
                          const names =
                            Array.isArray(p.playerNames) && p.playerNames.length
                              ? p.playerNames.join(" & ")
                              : "no players assigned";
                          const short = stripClub(p.name, awayName) || p.name;
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
                    </div>
                  )}
                  {/* Multi-set scores + delete-rubber */}
                  <div className="space-y-1.5">
                    {sets.map((st, idx) => (
                      <div
                        key={idx}
                        className="grid grid-cols-[28px_1fr_20px_1fr_28px] items-center gap-2"
                      >
                        <span
                          className="text-[10px] font-bold text-center"
                          style={{ color: BSL.muted }}
                        >
                          S{idx + 1}
                        </span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={st.h}
                          onChange={(e) =>
                            setScores((p) => {
                              const cur = (p[r.id] || []).slice();
                              cur[idx] = {
                                ...(cur[idx] || { h: "", a: "" }),
                                h: e.target.value,
                              };
                              return { ...p, [r.id]: cur };
                            })
                          }
                          className="w-full px-2 py-1.5 rounded-md text-center font-bold tabular-nums text-sm"
                          style={{
                            background: BSL.card,
                            border: `1px solid ${BSL.border}`,
                            color: "white",
                          }}
                          data-testid={`input-set-home-${r.id}-${idx}`}
                        />
                        <span
                          className="text-center font-black"
                          style={{ color: BSL.muted }}
                        >
                          –
                        </span>
                        <input
                          type="number"
                          min={0}
                          inputMode="numeric"
                          value={st.a}
                          onChange={(e) =>
                            setScores((p) => {
                              const cur = (p[r.id] || []).slice();
                              cur[idx] = {
                                ...(cur[idx] || { h: "", a: "" }),
                                a: e.target.value,
                              };
                              return { ...p, [r.id]: cur };
                            })
                          }
                          className="w-full px-2 py-1.5 rounded-md text-center font-bold tabular-nums text-sm"
                          style={{
                            background: BSL.card,
                            border: `1px solid ${BSL.border}`,
                            color: "white",
                          }}
                          data-testid={`input-set-away-${r.id}-${idx}`}
                        />
                        <button
                          onClick={() =>
                            setScores((p) => {
                              const cur = (p[r.id] || []).slice();
                              if (cur.length <= 1) {
                                return { ...p, [r.id]: [{ h: "", a: "" }] };
                              }
                              cur.splice(idx, 1);
                              return { ...p, [r.id]: cur };
                            })
                          }
                          className="p-1 rounded-md inline-flex items-center justify-center"
                          style={{
                            background: `${BSL.muted}22`,
                            color: BSL.muted,
                            border: `1px solid ${BSL.border}`,
                          }}
                          title="Remove set"
                          data-testid={`button-remove-set-${r.id}-${idx}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    <div className="flex items-center gap-2 justify-between pl-7">
                      <button
                        onClick={() =>
                          setScores((p) => ({
                            ...p,
                            [r.id]: [...(p[r.id] || []), { h: "", a: "" }],
                          }))
                        }
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold"
                        style={{
                          background: `${BSL.cyan}22`,
                          color: BSL.cyan,
                          border: `1px dashed ${BSL.cyan}55`,
                        }}
                        data-testid={`button-add-set-${r.id}`}
                      >
                        <Plus className="h-3 w-3" /> Add set
                      </button>
                      <span
                        className="text-[10px] font-bold tabular-nums"
                        style={{ color: BSL.muted }}
                      >
                        Sets won:{" "}
                        <span style={{ color: BSL.gold }}>{setSummary.h}</span>{" "}
                        –{" "}
                        <span style={{ color: BSL.gold }}>{setSummary.a}</span>
                      </span>
                      <button
                        onClick={() => handleDeleteRubber(r.id)}
                        className="p-1.5 rounded-md inline-flex items-center justify-center"
                        style={{
                          background: `${BSL.danger}22`,
                          color: BSL.danger,
                          border: `1px solid ${BSL.danger}55`,
                        }}
                        title="Remove rubber"
                        data-testid={`button-delete-rubber-${r.id}`}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* === ADD ANOTHER RUBBER === */}
        {!isLoading && !isError && (
          <div
            className="mt-4 rounded-xl p-3 flex items-center gap-2 flex-wrap"
            style={{
              background: BSL.cardSoft,
              border: `1px dashed ${BSL.cyan}55`,
            }}
            data-testid="add-rubber-bar"
          >
            <span
              className="text-[11px] uppercase tracking-widest font-bold"
              style={{ color: BSL.muted }}
            >
              Need another match?
            </span>
            <select
              value={newRubberType}
              onChange={(e) =>
                setNewRubberType(
                  e.target.value as (typeof RUBBER_TYPES)[number],
                )
              }
              className="text-xs font-bold px-2 py-1.5 rounded-md"
              style={{
                background: BSL.card,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="select-new-rubber-type"
            >
              {RUBBER_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <ActionButton
              variant="cyan"
              onClick={handleAddRubber}
              disabled={addingRubber}
              icon={<Plus className="h-3 w-3" />}
              testid="button-add-rubber"
            >
              {addingRubber ? "Adding…" : "Add rubber"}
            </ActionButton>
          </div>
        )}

        <div className="text-[11px] mt-3" style={{ color: BSL.faint }}>
          Rubber wins count toward the match score. Saving updates standings on
          the main dashboard immediately.
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: BSL.cardSoft, color: BSL.muted }}
            data-testid="button-cancel-finish"
          >
            Cancel
          </button>
          <ActionButton
            variant="danger"
            onClick={handleSave}
            disabled={saving || isLoading || isError}
            icon={<Trophy className="h-3 w-3" />}
            testid="button-confirm-finish"
          >
            {saving ? "Saving…" : "Save scores + finish"}
          </ActionButton>
        </div>
      </motion.div>
    </motion.div>
  );
}
