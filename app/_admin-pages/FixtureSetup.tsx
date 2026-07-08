import { useState, useMemo } from "react";
import { Link, useRoute } from "@/lib/routing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Users,
  Trophy,
  X,
  GripVertical,
  AlertTriangle,
  Check,
  Plus,
  Wand2,
  Trash2,
  Shuffle,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Player = { id: number; name: string };
type Pair = {
  id: number;
  pairNumber: number;
  category: string;
  bslClubId: number;
  division?: string | null;
  members: Player[];
};

// Compact display label used everywhere a pair is rendered. We prefer the
// actual player names ("Alice & Bob") over the legacy "Pair A/B/C" label
// because admins consistently ask "which players are these?" — names are
// what they recognise. Falls back to the category-tagged Pair letter when a
// pair has no members yet (newly-created empty slot).
function pairDisplayName(p: {
  pairNumber?: number;
  category?: string | null;
  members?: { name: string }[];
}): string {
  const names = (p.members || []).map((m) => m.name).filter(Boolean);
  if (names.length > 0) return names.join(" & ");
  const letter = String.fromCharCode(64 + (p.pairNumber || 1));
  return `Pair ${letter}${p.category ? ` · ${p.category}` : ""}`;
}
type Rubber = {
  id: number;
  rubberNumber: number;
  rubberType: string;
  homeTeamId: number | null;
  awayTeamId: number | null;
  homePlayer1Id: number | null;
  homePlayer2Id: number | null;
  awayPlayer1Id: number | null;
  awayPlayer2Id: number | null;
  status: string;
};
type SetupData = {
  fixture: any;
  rubbers: Rubber[];
  homeClub: any | null;
  awayClub: any | null;
  homePairs: Pair[];
  awayPairs: Pair[];
};

const RUBBER_LABEL: Record<string, string> = {
  MS1: "Men's Singles 1",
  MS2: "Men's Singles 2",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

export default function FixtureSetup() {
  const [, params] = useRoute("/admin/fixtures/:id/setup");
  const fixtureId = Number(params?.id);
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<SetupData>({
    queryKey: ["/api/bsl/admin/fixtures", fixtureId, "setup"],
    queryFn: async () =>
      (await fetch(`/api/bsl/admin/fixtures/${fixtureId}/setup`)).json(),
  });

  const [drag, setDrag] = useState<{
    side: "home" | "away";
    pair: Pair;
  } | null>(null);

  const invalidate = () =>
    qc.invalidateQueries({
      queryKey: ["/api/bsl/admin/fixtures", fixtureId, "setup"],
    });
  const errToast = (title: string) => (e: any) =>
    toast({
      title,
      description: (e?.message || "Error").replace(/^\d{3}:\s*/, ""),
      variant: "destructive",
    });

  const assign = useMutation({
    mutationFn: async (vars: {
      rubberId: number;
      side: "home" | "away";
      bslTeamId: number | null;
    }) =>
      (
        await apiRequest(
          "PATCH",
          `/api/bsl/admin/rubbers/${vars.rubberId}/assign`,
          { side: vars.side, bslTeamId: vars.bslTeamId },
        )
      ).json(),
    onSuccess: invalidate,
    onError: errToast("Couldn't assign"),
  });

  const addRubber = useMutation({
    mutationFn: async (rubberType: string) =>
      (
        await apiRequest(
          "POST",
          `/api/bsl/admin/fixtures/${fixtureId}/add-rubber`,
          { rubberType },
        )
      ).json(),
    onSuccess: invalidate,
    onError: errToast("Couldn't add rubber"),
  });

  const removeRubber = useMutation({
    mutationFn: async (vars: { rubberId: number; force?: boolean }) =>
      (
        await apiRequest(
          "DELETE",
          `/api/bsl/admin/rubbers/${vars.rubberId}${vars.force ? "?force=true" : ""}`,
        )
      ).json(),
    onSuccess: invalidate,
    onError: errToast("Couldn't remove rubber"),
  });

  const autoGenerate = useMutation({
    mutationFn: async (vars: {
      mode: "vs_all" | "parallel";
      replace: boolean;
      categories?: string[];
    }) =>
      (
        await apiRequest(
          "POST",
          `/api/bsl/admin/fixtures/${fixtureId}/auto-generate-rubbers`,
          vars,
        )
      ).json(),
    onSuccess: (r: any) => {
      toast({
        title: `Generated ${r.created} rubbers`,
        description: r.skipped
          ? `${r.skipped} categories skipped (no pairs on one side)`
          : undefined,
      });
      invalidate();
    },
    onError: errToast("Couldn't auto-generate"),
  });

  // Shuffle the running order so the same players don't play back-to-back
  // (they get a rest between, e.g. Men's Doubles then a break before Mixed).
  const reorder = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "POST",
          `/api/bsl/admin/fixtures/${fixtureId}/reorder-rubbers`,
          {},
        )
      ).json(),
    onSuccess: (r: any) => {
      toast({
        title: r.reordered > 1 ? "Order shuffled" : "Nothing to shuffle",
        description:
          r.reordered > 1
            ? `${r.reordered} matches spread out so players get a rest between their games.`
            : "Add at least two matches first.",
      });
      invalidate();
    },
    onError: errToast("Couldn't shuffle the order"),
  });

  // Build a quick lookup so each pair card can show whether it's already
  // slotted into a rubber and admins don't have to scroll back to check.
  const placement = useMemo(() => {
    const m = new Map<number, number[]>(); // teamId → rubberNumbers
    if (!data) return m;
    for (const r of data.rubbers) {
      if (r.homeTeamId != null)
        m.set(r.homeTeamId, [...(m.get(r.homeTeamId) || []), r.rubberNumber]);
      if (r.awayTeamId != null)
        m.set(r.awayTeamId, [...(m.get(r.awayTeamId) || []), r.rubberNumber]);
    }
    return m;
  }, [data]);

  if (isLoading || !data) {
    return (
      <AdminLayout active="league">
        <div className="text-center py-12" style={{ color: BSL.muted }}>
          Loading fixture…
        </div>
      </AdminLayout>
    );
  }

  const { fixture, rubbers, homeClub, awayClub, homePairs, awayPairs } = data;
  const isClubFixture =
    fixture.homeClubId != null && fixture.awayClubId != null;
  const slotsAssigned = rubbers.filter(
    (r) => r.homeTeamId && r.awayTeamId,
  ).length;

  if (!isClubFixture) {
    return (
      <AdminLayout active="league">
        <div className="max-w-3xl mx-auto">
          <Link href="/admin/league">
            <a
              className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-4"
              style={{ color: BSL.muted }}
              data-testid="link-back-league"
            >
              <ArrowLeft className="h-3 w-3" /> League Control
            </a>
          </Link>
          <GlowPanel
            title="Not a club-vs-club fixture"
            tone="cyan"
            icon={<AlertTriangle className="h-4 w-4" />}
          >
            <p className="text-sm" style={{ color: BSL.muted }}>
              This fixture was generated by the legacy round-robin (pair vs
              pair). Pair-to-rubber assignment is only available for fixtures
              created via "New club-vs-club fixture".
            </p>
          </GlowPanel>
        </div>
      </AdminLayout>
    );
  }

  const onDropOnRubber = (rubberId: number, side: "home" | "away") => {
    if (!drag || drag.side !== side) {
      toast({
        title: "Drop on the right side",
        description: `That pair is from the ${drag?.side} club.`,
        variant: "destructive",
      });
      setDrag(null);
      return;
    }
    assign.mutate({ rubberId, side, bslTeamId: drag.pair.id });
    setDrag(null);
  };

  return (
    <AdminLayout active="league">
      <div className="mb-6">
        <Link href="/admin/league">
          <a
            className="inline-flex items-center gap-1.5 text-xs hover:opacity-80 mb-2"
            style={{ color: BSL.muted }}
            data-testid="link-back-league"
          >
            <ArrowLeft className="h-3 w-3" /> League Control
          </a>
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div
              className="text-xs uppercase tracking-widest"
              style={{ color: BSL.cyan }}
            >
              Fixture #{fixture.id} · Pair Assignment
            </div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
              {homeClub?.name || "Home"}{" "}
              <span style={{ color: BSL.gold }}>vs</span>{" "}
              {awayClub?.name || "Away"}
            </h1>
            <p className="text-sm mt-1" style={{ color: BSL.muted }}>
              {slotsAssigned} of {rubbers.length} rubbers fully assigned · drag
              a pair onto any rubber slot
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant="gold"
              onClick={() => {
                if (
                  rubbers.length > 0 &&
                  !confirm(
                    `Replace all ${rubbers.length} existing rubbers with auto-generated vs-all matchups?`,
                  )
                )
                  return;
                autoGenerate.mutate({
                  mode: "vs_all",
                  replace: rubbers.length > 0,
                });
              }}
              disabled={autoGenerate.isPending}
              data-testid="button-auto-vs-all"
            >
              <Wand2 className="h-3.5 w-3.5 mr-1" /> Auto-generate (vs all)
            </ActionButton>
            <ActionButton
              variant="cyan"
              onClick={() => {
                if (
                  rubbers.length > 0 &&
                  !confirm(
                    `Replace all ${rubbers.length} existing rubbers with pair-by-pair matchups?`,
                  )
                )
                  return;
                autoGenerate.mutate({
                  mode: "parallel",
                  replace: rubbers.length > 0,
                });
              }}
              disabled={autoGenerate.isPending}
              data-testid="button-auto-parallel"
            >
              <Wand2 className="h-3.5 w-3.5 mr-1" /> Pair-by-pair
            </ActionButton>
            <ActionButton
              variant="gold"
              onClick={() => reorder.mutate()}
              disabled={reorder.isPending || rubbers.length < 2}
              data-testid="button-shuffle-order"
              title="Spread matches out so players get a rest between their games"
            >
              <Shuffle className="h-3.5 w-3.5 mr-1" /> Shuffle order (rest
              between games)
            </ActionButton>
            <Link href={`/match/${fixture.id}`}>
              <ActionButton variant="cyan" data-testid="link-open-match">
                Open match view
              </ActionButton>
            </Link>
          </div>
        </div>
      </div>

      {/* Add-rubber chips: append a single empty slot of the chosen category.
          Click multiple times to add multiple matches of the same type. */}
      <div
        className="mb-4 p-3 rounded-xl flex flex-wrap items-center gap-2"
        style={{ background: BSL.cardSoft, border: `1px solid ${BSL.cyan}33` }}
      >
        <span
          className="text-[11px] uppercase tracking-widest font-bold"
          style={{ color: BSL.cyan }}
        >
          + Add another match
        </span>
        <span className="text-[10px]" style={{ color: BSL.muted }}>
          (click to append · keep clicking for more)
        </span>
        <div className="flex-1" />
        {(["MD", "WD", "XD", "MS1", "MS2", "WS"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => addRubber.mutate(cat)}
            disabled={addRubber.isPending}
            className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-bold hover:opacity-80 disabled:opacity-50 transition"
            style={{
              background: `${BSL.cyan}22`,
              color: BSL.cyan,
              border: `1px solid ${BSL.cyan}55`,
            }}
            data-testid={`button-add-rubber-${cat}`}
            title={RUBBER_LABEL[cat] || cat}
          >
            <Plus className="h-3 w-3" /> {cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* HOME PAIRS */}
        <div className="lg:col-span-3">
          <PairColumn
            side="home"
            club={homeClub}
            pairs={homePairs}
            placement={placement}
            drag={drag}
            setDrag={setDrag}
          />
        </div>

        {/* RUBBER SLOTS */}
        <div className="lg:col-span-6 space-y-2.5">
          <GlowPanel
            title="Rubber slots"
            subtitle="Drag a pair from either side onto its slot"
            tone="gold"
            icon={<Trophy className="h-4 w-4" />}
          >
            <div className="space-y-2.5">
              {rubbers.map((r) => (
                <RubberRow
                  key={r.id}
                  rubber={r}
                  homePairs={homePairs}
                  awayPairs={awayPairs}
                  drag={drag}
                  onDrop={(side) => onDropOnRubber(r.id, side)}
                  onClear={(side) =>
                    assign.mutate({ rubberId: r.id, side, bslTeamId: null })
                  }
                  onPick={(side, bslTeamId) =>
                    assign.mutate({ rubberId: r.id, side, bslTeamId })
                  }
                  onDelete={() => {
                    const force = !!(r.homeTeamId || r.awayTeamId);
                    if (
                      force &&
                      !confirm(
                        `Rubber ${r.rubberNumber} has assignments — delete anyway?`,
                      )
                    )
                      return;
                    removeRubber.mutate({ rubberId: r.id, force });
                  }}
                />
              ))}
            </div>
          </GlowPanel>
        </div>

        {/* AWAY PAIRS */}
        <div className="lg:col-span-3">
          <PairColumn
            side="away"
            club={awayClub}
            pairs={awayPairs}
            placement={placement}
            drag={drag}
            setDrag={setDrag}
          />
        </div>
      </div>
    </AdminLayout>
  );
}

function PairColumn({
  side,
  club,
  pairs,
  placement,
  drag,
  setDrag,
}: {
  side: "home" | "away";
  club: any | null;
  pairs: Pair[];
  placement: Map<number, number[]>;
  drag: { side: "home" | "away"; pair: Pair } | null;
  setDrag: (v: any) => void;
}) {
  const tone = side === "home" ? BSL.cyan : BSL.gold;
  return (
    <GlowPanel
      title={`${side === "home" ? "Home" : "Away"} · ${club?.name || "Club"}`}
      subtitle={`${pairs.length} pairs registered`}
      tone={side === "home" ? "cyan" : "gold"}
      icon={<Users className="h-4 w-4" />}
    >
      {pairs.length === 0 ? (
        <div className="text-xs py-3 text-center" style={{ color: BSL.muted }}>
          No pairs in this club yet.
        </div>
      ) : (
        <div className="space-y-2">
          {pairs.map((p) => {
            const slotted = placement.get(p.id) || [];
            const isDragging = drag?.pair.id === p.id;
            return (
              <motion.div
                key={p.id}
                draggable
                onDragStart={(e: any) => {
                  setDrag({ side, pair: p });
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => setDrag(null)}
                whileHover={{ y: -1 }}
                animate={{
                  opacity: isDragging ? 0.5 : 1,
                  scale: isDragging ? 0.98 : 1,
                }}
                className="rounded-xl p-2.5 cursor-grab active:cursor-grabbing select-none"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${tone}33`,
                }}
                data-testid={`pair-card-${side}-${p.id}`}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <GripVertical className="h-3 w-3 opacity-40 shrink-0" />
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-black shrink-0"
                      style={{ background: `${tone}22`, color: tone }}
                    >
                      {p.category}
                    </span>
                    <span
                      className="text-xs font-bold truncate"
                      title={pairDisplayName(p)}
                    >
                      {pairDisplayName({ ...p, category: null })}
                    </span>
                  </div>
                  {slotted.length > 0 && (
                    <span
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0"
                      style={{
                        background: `${BSL.success}22`,
                        color: BSL.success,
                      }}
                      title={`Assigned to rubber ${slotted.join(", ")} — can be placed in more`}
                    >
                      R{slotted.join("·")}
                    </span>
                  )}
                </div>
                {p.members.length === 0 && (
                  <div
                    className="text-[11px] italic"
                    style={{ color: BSL.faint }}
                  >
                    Empty pair
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </GlowPanel>
  );
}

function RubberRow({
  rubber,
  homePairs,
  awayPairs,
  drag,
  onDrop,
  onClear,
  onPick,
  onDelete,
}: {
  rubber: Rubber;
  homePairs: Pair[];
  awayPairs: Pair[];
  drag: { side: "home" | "away"; pair: Pair } | null;
  onDrop: (side: "home" | "away") => void;
  onClear: (side: "home" | "away") => void;
  onPick: (side: "home" | "away", bslTeamId: number) => void;
  onDelete: () => void;
}) {
  const isDoubles = ["MD", "WD", "XD"].includes(rubber.rubberType);
  const eligibleHome = homePairs.filter(
    (p) => !isDoubles || p.category === rubber.rubberType,
  );
  const eligibleAway = awayPairs.filter(
    (p) => !isDoubles || p.category === rubber.rubberType,
  );
  const homePair = homePairs.find((p) => p.id === rubber.homeTeamId);
  const awayPair = awayPairs.find((p) => p.id === rubber.awayTeamId);

  return (
    <div
      className="rounded-xl p-2.5"
      style={{ background: BSL.cardSoft, border: `1px solid ${BSL.border}` }}
      data-testid={`rubber-row-${rubber.id}`}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="h-7 w-7 rounded-full inline-flex items-center justify-center text-xs font-black"
            style={{ background: `${BSL.gold}22`, color: BSL.gold }}
          >
            {rubber.rubberNumber}
          </span>
          <div>
            <div className="text-sm font-bold">
              {RUBBER_LABEL[rubber.rubberType] || rubber.rubberType}
            </div>
            <div
              className="text-[10px] uppercase tracking-widest"
              style={{ color: BSL.muted }}
            >
              {rubber.status}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {rubber.homeTeamId && rubber.awayTeamId && (
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded"
              style={{ background: `${BSL.success}22`, color: BSL.success }}
            >
              <Check className="h-3 w-3 inline" /> Ready
            </span>
          )}
          <button
            onClick={onDelete}
            className="p-1 rounded hover:opacity-80 transition"
            style={{ color: BSL.muted }}
            title="Delete rubber"
            data-testid={`button-delete-rubber-${rubber.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RubberSlot
          side="home"
          pair={homePair}
          eligible={eligibleHome}
          canDrop={drag?.side === "home"}
          onDrop={() => onDrop("home")}
          onClear={() => onClear("home")}
          onPick={(id) => onPick("home", id)}
        />
        <RubberSlot
          side="away"
          pair={awayPair}
          eligible={eligibleAway}
          canDrop={drag?.side === "away"}
          onDrop={() => onDrop("away")}
          onClear={() => onClear("away")}
          onPick={(id) => onPick("away", id)}
        />
      </div>
    </div>
  );
}

function RubberSlot({
  side,
  pair,
  eligible,
  canDrop,
  onDrop,
  onClear,
  onPick,
}: {
  side: "home" | "away";
  pair: Pair | undefined;
  eligible: Pair[];
  canDrop: boolean;
  onDrop: () => void;
  onClear: () => void;
  onPick: (bslTeamId: number) => void;
}) {
  const tone = side === "home" ? BSL.cyan : BSL.gold;
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
      }}
      onDrop={onDrop}
      className="rounded-lg p-2 min-h-[68px] transition-all"
      style={{
        background: canDrop
          ? `linear-gradient(135deg, ${tone}11, ${BSL.card})`
          : BSL.card,
        border: `1px ${canDrop ? "solid" : "dashed"} ${canDrop ? tone : BSL.border}`,
        boxShadow: canDrop ? `0 0 16px ${tone}33` : "none",
      }}
      data-testid={`rubber-slot-${side}`}
    >
      <AnimatePresence mode="wait">
        {pair ? (
          <motion.div
            key="filled"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="flex items-center justify-between mb-0.5">
              <span
                className="text-[9px] uppercase tracking-widest font-black"
                style={{ color: tone }}
              >
                {side}
              </span>
              <button
                onClick={onClear}
                className="p-0.5 hover:opacity-70"
                data-testid={`button-clear-${side}`}
              >
                <X className="h-3 w-3" style={{ color: BSL.muted }} />
              </button>
            </div>
            <div
              className="text-xs font-bold truncate"
              title={pairDisplayName(pair)}
            >
              {pairDisplayName({ ...pair, category: null })}
            </div>
            <div className="text-[10px] truncate" style={{ color: BSL.muted }}>
              {pair.category}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="text-[9px] uppercase tracking-widest font-black mb-1"
              style={{ color: tone }}
            >
              {side}
            </div>
            {eligible.length === 0 ? (
              <div className="text-[10px] italic" style={{ color: BSL.faint }}>
                No eligible pair
              </div>
            ) : (
              <select
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v) onPick(v);
                }}
                defaultValue=""
                className="w-full text-[10px] rounded px-1.5 py-1"
                style={{
                  background: BSL.cardSoft,
                  color: "white",
                  border: `1px solid ${BSL.border}`,
                }}
                data-testid={`select-${side}`}
              >
                <option value="">+ Pick or drop pair…</option>
                {eligible.map((p) => (
                  <option key={p.id} value={p.id}>
                    {pairDisplayName({ ...p, category: null })} · {p.category}
                  </option>
                ))}
              </select>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
