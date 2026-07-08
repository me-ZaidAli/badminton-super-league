import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Sliders,
  Save,
  Plus,
  Trash2,
  History,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const RUBBER_OPTIONS = ["MS1", "MS2", "WS", "MD", "WD", "XD"];
const SCORING_OPTIONS = [
  { value: "DEUCE", label: "Deuce (win by 2)" },
  { value: "GOLDEN_POINT", label: "Golden point (sudden death at deuce)" },
  { value: "RALLY", label: "Rally scoring" },
];
const FORMAT_OPTIONS = [
  { value: "ROUND_ROBIN", label: "Round robin" },
  { value: "KNOCKOUT", label: "Knockout" },
  { value: "GROUPS", label: "Groups → KO" },
];
const TIEBREAK_TOKENS = [
  "POINTS",
  "RUBBER_DIFF",
  "RUBBERS_FOR",
  "HEAD_TO_HEAD",
  "MATCHES_WON",
];
const TIEBREAK_LABEL: Record<string, string> = {
  POINTS: "League points",
  RUBBER_DIFF: "Rubber diff",
  RUBBERS_FOR: "Rubbers won",
  HEAD_TO_HEAD: "Head-to-head",
  MATCHES_WON: "Matches won",
};

const DEFAULT_DRAFT = {
  rubbersPerFixture: 6,
  rubberLineup: ["MD", "MD", "WD", "WD", "XD", "XD"],
  setsPerMatch: 3,
  pointsPerSet: 21,
  scoringRule: "DEUCE",
  deuceCap: 30,
  format: "ROUND_ROBIN",
  walkoverPolicy: "STANDARD",
  walkoverScore: 21,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakOrder: ["POINTS", "RUBBER_DIFF", "RUBBERS_FOR", "HEAD_TO_HEAD"],
  courtPool: [] as number[],
  notes: "",
};

function Field({ label, hint, children }: any) {
  return (
    <label className="block">
      <div
        className="text-[10px] uppercase tracking-widest font-bold mb-1"
        style={{ color: BSL.muted }}
      >
        {label}
      </div>
      {children}
      {hint && (
        <div className="text-[10px] mt-1" style={{ color: BSL.faint }}>
          {hint}
        </div>
      )}
    </label>
  );
}

function NumberInput({ value, onChange, min = 0, max = 99, testid }: any) {
  // Allow the field to be fully cleared while typing — only clamp on blur.
  // Otherwise typing one character (or deleting) snaps the value back to 0/min
  // and the user can never type a multi-digit number.
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value === "" || value == null ? "" : value}
      onChange={(e) => {
        const v = e.target.value;
        onChange(v === "" ? "" : Number(v));
      }}
      onBlur={(e) => {
        const v = e.target.value;
        if (v === "") {
          onChange(min);
          return;
        }
        const n = Number(v);
        if (!Number.isFinite(n)) onChange(min);
        else if (n < min) onChange(min);
        else if (n > max) onChange(max);
      }}
      className="w-full px-3 py-2 rounded-lg text-sm tabular-nums"
      style={{
        background: BSL.cardSoft,
        border: `1px solid ${BSL.border}`,
        color: "white",
      }}
      data-testid={testid}
    />
  );
}

function Select({ value, onChange, options, testid }: any) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg text-sm"
      style={{
        background: BSL.cardSoft,
        border: `1px solid ${BSL.border}`,
        color: "white",
      }}
      data-testid={testid}
    >
      {options.map((o: any) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function CategoryCard({ row, onChange }: any) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<any>({ ...DEFAULT_DRAFT, ...row });
  const dirty =
    JSON.stringify(draft) !== JSON.stringify({ ...DEFAULT_DRAFT, ...row });

  const save = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "PUT",
          `/api/bsl/admin/category-settings/${row.category}`,
          draft,
        )
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/category-settings"] });
      toast({ title: `Saved ${row.category}` });
      onChange?.();
    },
    onError: (e: any) =>
      toast({
        title: "Save failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  const del = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "DELETE",
          `/api/bsl/admin/category-settings/${row.category}`,
          {},
        )
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/category-settings"] });
      toast({ title: `Removed ${row.category}` });
    },
  });

  const lineup: string[] = draft.rubberLineup || [];
  function setLineupAt(i: number, v: string) {
    const next = [...lineup];
    next[i] = v;
    setDraft({ ...draft, rubberLineup: next });
  }
  function setRubberCount(n: number) {
    const next = [...lineup];
    while (next.length < n) next.push(next[next.length - 1] || "MD");
    while (next.length > n) next.pop();
    setDraft({ ...draft, rubbersPerFixture: n, rubberLineup: next });
  }
  function toggleTiebreak(token: string) {
    const cur: string[] = draft.tiebreakOrder || [];
    setDraft({
      ...draft,
      tiebreakOrder: cur.includes(token)
        ? cur.filter((t) => t !== token)
        : [...cur, token],
    });
  }
  function moveTiebreak(token: string, dir: -1 | 1) {
    const cur: string[] = [...(draft.tiebreakOrder || [])];
    const i = cur.indexOf(token);
    if (i < 0) return;
    const j = i + dir;
    if (j < 0 || j >= cur.length) return;
    [cur[i], cur[j]] = [cur[j], cur[i]];
    setDraft({ ...draft, tiebreakOrder: cur });
  }

  return (
    <GlowPanel
      title={
        <span className="inline-flex items-center gap-2">
          <span style={{ color: BSL.gold }}>{row.category}</span> · settings
        </span>
      }
      tone={dirty ? "gold" : "cyan"}
      icon={<Sliders className="h-4 w-4" />}
      data-testid={`panel-cat-${row.category}`}
    >
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
        <Field
          label="Rubbers per fixture"
          hint="Total games in one club-vs-club tie"
        >
          <NumberInput
            value={draft.rubbersPerFixture}
            onChange={(v: number) =>
              setRubberCount(Math.max(1, Math.min(20, v)))
            }
            min={1}
            max={20}
            testid={`input-rubbers-${row.category}`}
          />
        </Field>
        <Field
          label="Sets per match"
          hint="Best-of will be (n*2)-1 — n=2 means 'best of 3'"
        >
          <NumberInput
            value={draft.setsPerMatch}
            onChange={(v: number) => setDraft({ ...draft, setsPerMatch: v })}
            min={1}
            max={7}
            testid={`input-sets-${row.category}`}
          />
        </Field>
        <Field label="Points per set">
          <NumberInput
            value={draft.pointsPerSet}
            onChange={(v: number) => setDraft({ ...draft, pointsPerSet: v })}
            min={1}
            max={99}
            testid={`input-points-${row.category}`}
          />
        </Field>
        <Field label="Match format">
          <Select
            value={draft.format}
            onChange={(v: string) => setDraft({ ...draft, format: v })}
            options={FORMAT_OPTIONS}
            testid={`select-format-${row.category}`}
          />
        </Field>
        <Field label="Scoring rule">
          <Select
            value={draft.scoringRule}
            onChange={(v: string) => setDraft({ ...draft, scoringRule: v })}
            options={SCORING_OPTIONS}
            testid={`select-scoring-${row.category}`}
          />
        </Field>
        <Field label="Deuce cap" hint="Hard ceiling at deuce (0 = none)">
          <NumberInput
            value={draft.deuceCap}
            onChange={(v: number) => setDraft({ ...draft, deuceCap: v })}
            min={0}
            max={99}
            testid={`input-deucecap-${row.category}`}
          />
        </Field>
        <Field label="Walkover score">
          <NumberInput
            value={draft.walkoverScore}
            onChange={(v: number) => setDraft({ ...draft, walkoverScore: v })}
            min={0}
            max={99}
            testid={`input-wo-${row.category}`}
          />
        </Field>
        <Field label="Points · Win">
          <NumberInput
            value={draft.pointsWin}
            onChange={(v: number) => setDraft({ ...draft, pointsWin: v })}
            min={0}
            max={99}
            testid={`input-pw-${row.category}`}
          />
        </Field>
        <Field label="Points · Draw">
          <NumberInput
            value={draft.pointsDraw}
            onChange={(v: number) => setDraft({ ...draft, pointsDraw: v })}
            min={0}
            max={99}
            testid={`input-pd-${row.category}`}
          />
        </Field>
        <Field label="Points · Loss">
          <NumberInput
            value={draft.pointsLoss}
            onChange={(v: number) => setDraft({ ...draft, pointsLoss: v })}
            min={0}
            max={99}
            testid={`input-pl-${row.category}`}
          />
        </Field>
      </div>

      <div className="mb-4">
        <div
          className="text-[10px] uppercase tracking-widest font-bold mb-2"
          style={{ color: BSL.muted }}
        >
          Rubber lineup ({lineup.length})
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {lineup.map((t, i) => (
            <select
              key={i}
              value={t}
              onChange={(e) => setLineupAt(i, e.target.value)}
              className="px-2 py-1.5 rounded-lg text-xs font-bold"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: BSL.cyan,
              }}
              data-testid={`select-lineup-${row.category}-${i}`}
            >
              {RUBBER_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </select>
          ))}
        </div>
      </div>

      <div className="mb-4">
        <div
          className="text-[10px] uppercase tracking-widest font-bold mb-2"
          style={{ color: BSL.muted }}
        >
          Tiebreak priority (drag-equivalent: use arrows)
        </div>
        <div className="space-y-1">
          {(draft.tiebreakOrder || []).map((token: string, i: number) => (
            <div
              key={token}
              className="flex items-center gap-2 p-2 rounded-lg"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
              }}
            >
              <span
                className="w-5 text-center font-black"
                style={{ color: BSL.gold }}
              >
                {i + 1}
              </span>
              <span className="flex-1 text-sm font-bold">
                {TIEBREAK_LABEL[token] || token}
              </span>
              <button
                onClick={() => moveTiebreak(token, -1)}
                disabled={i === 0}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ background: BSL.card, color: BSL.muted }}
                data-testid={`btn-tb-up-${row.category}-${token}`}
              >
                ↑
              </button>
              <button
                onClick={() => moveTiebreak(token, 1)}
                disabled={i === draft.tiebreakOrder.length - 1}
                className="px-2 py-1 rounded text-xs disabled:opacity-30"
                style={{ background: BSL.card, color: BSL.muted }}
                data-testid={`btn-tb-dn-${row.category}-${token}`}
              >
                ↓
              </button>
              <button
                onClick={() => toggleTiebreak(token)}
                className="px-2 py-1 rounded text-xs"
                style={{ background: `${BSL.danger}22`, color: BSL.danger }}
                data-testid={`btn-tb-rm-${row.category}-${token}`}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">
          {TIEBREAK_TOKENS.filter(
            (t) => !(draft.tiebreakOrder || []).includes(t),
          ).map((t) => (
            <button
              key={t}
              onClick={() => toggleTiebreak(t)}
              className="text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded-md"
              style={{ background: `${BSL.cyan}22`, color: BSL.cyan }}
              data-testid={`btn-tb-add-${row.category}-${t}`}
            >
              + {TIEBREAK_LABEL[t]}
            </button>
          ))}
        </div>
      </div>

      <Field
        label="Court pool (comma separated court numbers)"
        hint="Leave blank to allow any available court"
      >
        <input
          value={(draft.courtPool || []).join(", ")}
          onChange={(e) => {
            const parts = e.target.value
              .split(/[,\s]+/)
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isFinite(n) && n >= 1);
            setDraft({ ...draft, courtPool: Array.from(new Set(parts)) });
          }}
          placeholder="e.g. 1, 2, 3"
          className="w-full px-3 py-2 rounded-lg text-sm tabular-nums"
          style={{
            background: BSL.cardSoft,
            border: `1px solid ${BSL.border}`,
            color: "white",
          }}
          data-testid={`input-courts-${row.category}`}
        />
      </Field>

      <Field label="Notes (admin-only)">
        <textarea
          value={draft.notes || ""}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          rows={2}
          className="w-full px-3 py-2 rounded-lg text-sm resize-none mt-1"
          style={{
            background: BSL.cardSoft,
            border: `1px solid ${BSL.border}`,
            color: "white",
          }}
          data-testid={`input-notes-${row.category}`}
        />
      </Field>

      <div className="flex justify-between items-center pt-4">
        <button
          onClick={() => {
            if (confirm(`Delete settings for ${row.category}?`)) del.mutate();
          }}
          className="text-xs inline-flex items-center gap-1"
          style={{ color: BSL.danger }}
          data-testid={`button-delete-${row.category}`}
        >
          <Trash2 className="h-3 w-3" /> Delete
        </button>
        <div className="flex gap-2">
          {dirty && (
            <span
              className="text-[10px] uppercase tracking-widest font-bold self-center"
              style={{ color: BSL.gold }}
            >
              Unsaved
            </span>
          )}
          <ActionButton
            variant="cyan"
            onClick={() => save.mutate()}
            disabled={!dirty || save.isPending}
            icon={<Save className="h-3 w-3" />}
          >
            {save.isPending ? "Saving…" : "Save settings"}
          </ActionButton>
        </div>
      </div>
    </GlowPanel>
  );
}

function NewCategoryRow({ existing }: { existing: string[] }) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [cat, setCat] = useState("");
  const create = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "PUT",
          `/api/bsl/admin/category-settings/${cat.toUpperCase()}`,
          DEFAULT_DRAFT,
        )
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/category-settings"] });
      setCat("");
      toast({ title: "Category added" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });
  const taken = existing
    .map((c) => c.toUpperCase())
    .includes(cat.toUpperCase());
  return (
    <div className="flex gap-2 items-center">
      <input
        value={cat}
        onChange={(e) =>
          setCat(e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16))
        }
        placeholder="New category code (e.g. MS, BD60)"
        className="flex-1 px-3 py-2 rounded-lg text-sm uppercase"
        style={{
          background: BSL.cardSoft,
          border: `1px solid ${BSL.border}`,
          color: "white",
        }}
        data-testid="input-new-cat"
      />
      <ActionButton
        variant="gold"
        onClick={() => create.mutate()}
        disabled={!cat || taken || create.isPending}
        icon={<Plus className="h-3 w-3" />}
        testid="button-add-cat"
      >
        {taken ? "Already exists" : create.isPending ? "Adding…" : "Add"}
      </ActionButton>
    </div>
  );
}

function VersionHistory() {
  const { data } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/fixture-versions"],
  });
  if (!data?.length) {
    return (
      <div className="text-xs py-3 text-center" style={{ color: BSL.muted }}>
        No archived fixture batches yet — appears here after a Regenerate.
      </div>
    );
  }
  return (
    <div className="space-y-1">
      {data.slice(0, 30).map((v: any) => (
        <div
          key={v.id}
          className="flex items-center justify-between p-2 rounded-lg text-xs"
          style={{
            background: BSL.cardSoft,
            border: `1px solid ${BSL.border}`,
          }}
          data-testid={`row-version-${v.id}`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className="px-2 py-0.5 rounded font-black text-[10px] uppercase tracking-widest"
              style={{ background: `${BSL.gold}22`, color: BSL.gold }}
            >
              v{v.version}
            </span>
            <div className="truncate">
              <div className="font-bold">
                {v.division || "—"} · {v.category || "ALL"}
              </div>
              <div style={{ color: BSL.muted }}>
                {v.fixtureCount} fixtures ·{" "}
                {new Date(v.archivedAt).toLocaleString("en-GB")}
              </div>
            </div>
          </div>
          {v.reason && (
            <span
              className="text-[10px] truncate ml-2"
              style={{ color: BSL.faint }}
            >
              {v.reason}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

function RegeneratePanel() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const { data: days } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/league-days"],
  });
  const { data: cats } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/category-settings"],
  });
  const [division, setDivision] = useState("");
  const [category, setCategory] = useState("");
  const [leagueDayId, setLeagueDayId] = useState("");
  const [reason, setReason] = useState("");
  const regen = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/bsl/admin/fixtures/regenerate", {
          division,
          category: category || undefined,
          leagueDayId: leagueDayId ? Number(leagueDayId) : undefined,
          reason: reason || undefined,
        })
      ).json(),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/fixture-versions"] });
      toast({
        title: `Regenerated v${d.version}`,
        description: `${d.archived} archived · ${d.created} created`,
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });
  const divisions: string[] = league?.divisions || [];
  return (
    <GlowPanel
      title="Regenerate fixtures"
      subtitle="Archives previous batch then rebuilds with current settings"
      tone="gold"
      icon={<RefreshCw className="h-4 w-4" />}
    >
      <div
        className="flex items-start gap-2 p-3 mb-3 rounded-lg text-xs"
        style={{
          background: `${BSL.gold}11`,
          border: `1px solid ${BSL.gold}33`,
        }}
      >
        <AlertTriangle
          className="h-4 w-4 flex-shrink-0 mt-0.5"
          style={{ color: BSL.gold }}
        />
        <span style={{ color: BSL.muted }}>
          Only <b>SCHEDULED / WARMUP</b> fixtures are replaced. Fixtures that
          are LIVE or FINISHED are preserved as-is.
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="Division">
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="select-regen-div"
          >
            <option value="">Select division…</option>
            {divisions.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Category (optional)">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="select-regen-cat"
          >
            <option value="">— All categories —</option>
            {(cats || []).map((c: any) => (
              <option key={c.category} value={c.category}>
                {c.category}
              </option>
            ))}
          </select>
        </Field>
        <Field label="League day (optional)">
          <select
            value={leagueDayId}
            onChange={(e) => setLeagueDayId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="select-regen-day"
          >
            <option value="">— Any —</option>
            {(days || []).map((d: any) => (
              <option key={d.id} value={d.id}>
                {new Date(d.date).toLocaleDateString("en-GB")} · {d.state}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Reason (audit log)">
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. switched to best-of-3"
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="input-regen-reason"
          />
        </Field>
      </div>
      <div className="mt-4">
        <ActionButton
          variant="gold"
          onClick={() => {
            if (!division) return;
            if (
              !confirm(
                `Regenerate fixtures for ${division}${category ? " / " + category : ""}? Existing scheduled fixtures will be archived.`,
              )
            )
              return;
            regen.mutate();
          }}
          disabled={!division || regen.isPending}
          icon={<RefreshCw className="h-3 w-3" />}
          testid="button-regen-go"
        >
          {regen.isPending ? "Regenerating…" : "Regenerate"}
        </ActionButton>
      </div>
    </GlowPanel>
  );
}

export default function CompetitionSettings() {
  const { data: rows } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/category-settings"],
  });
  const sorted = useMemo(
    () =>
      (rows || []).slice().sort((a, b) => a.category.localeCompare(b.category)),
    [rows],
  );

  return (
    <AdminLayout active="competition">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
          Competition <span style={{ color: BSL.gold }}>Settings</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: BSL.muted }}>
          Per-category rules · snapshot onto fixtures at generation time ·
          regenerate without losing history
        </p>
      </div>

      <div className="mb-5">
        <RegeneratePanel />
      </div>

      <div className="mb-5">
        <GlowPanel
          title="Add a category"
          tone="cyan"
          icon={<Plus className="h-4 w-4" />}
        >
          <NewCategoryRow existing={sorted.map((r: any) => r.category)} />
        </GlowPanel>
      </div>

      <div className="space-y-5">
        {sorted.map((row: any) => (
          <CategoryCard key={row.id} row={row} />
        ))}
        {sorted.length === 0 && (
          <div
            className="py-12 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            No category settings yet. Add MD / WD / XD above to start.
          </div>
        )}
      </div>

      <div className="mt-5">
        <GlowPanel
          title="Fixture version history"
          subtitle="Archived snapshots from each Regenerate"
          tone="gold"
          icon={<History className="h-4 w-4" />}
        >
          <VersionHistory />
        </GlowPanel>
      </div>
    </AdminLayout>
  );
}
