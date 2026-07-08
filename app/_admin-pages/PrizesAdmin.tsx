import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Wand2,
  Crown,
  Medal,
  Gem,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Prize = {
  id: number;
  division: string | null;
  category: string | null;
  rank: number;
  tier: string;
  title: string;
  subtitle: string | null;
  prizeText: string;
  prizeAmountPence: number | null;
  isPublished: boolean;
  sortOrder: number;
};

const TIERS = [
  "DIAMOND",
  "PLATINUM",
  "GOLD",
  "SILVER",
  "BRONZE",
  "MYTHIC",
  "EPIC",
];
const TIER_TONE: Record<string, string> = {
  DIAMOND: "hsl(195,100%,72%)",
  PLATINUM: "hsl(210,30%,88%)",
  GOLD: BSL.gold,
  SILVER: "hsl(220,15%,82%)",
  BRONZE: "hsl(28,80%,62%)",
  MYTHIC: "hsl(280,90%,70%)",
  EPIC: "hsl(160,80%,55%)",
};
const TIER_ICON: Record<string, any> = {
  DIAMOND: Gem,
  PLATINUM: Sparkles,
  GOLD: Crown,
  SILVER: Medal,
  BRONZE: Medal,
  MYTHIC: Star,
  EPIC: Zap,
};
const CATS = [
  { v: "", l: "Overall (no category)" },
  { v: "MD", l: "MD — Men's Doubles" },
  { v: "WD", l: "WD — Women's Doubles" },
  { v: "XD", l: "XD — Mixed Doubles" },
  { v: "MS1", l: "MS1 — Men's Singles 1" },
  { v: "MS2", l: "MS2 — Men's Singles 2" },
  { v: "WS", l: "WS — Women's Singles" },
];

function clean(msg?: string) {
  return (msg || "").replace(/^\d{3}:\s*/, "");
}

export default function PrizesAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: prizes = [], isLoading } = useQuery<Prize[]>({
    queryKey: ["/api/bsl/prizes"],
  });
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const divisions: string[] = league?.divisions || [];
  const [editing, setEditing] = useState<Prize | null>(null);
  const [creating, setCreating] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["/api/bsl/prizes"] });

  const seed = useMutation({
    mutationFn: async (replace: boolean) =>
      (
        await apiRequest("POST", "/api/bsl/admin/prizes/seed", { replace })
      ).json(),
    onSuccess: (d: any) => {
      refresh();
      toast({ title: `Seeded ${d.count} prizes` });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't seed",
        description: clean(e?.message),
        variant: "destructive",
      }),
  });
  const del = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("DELETE", `/api/bsl/admin/prizes/${id}`, {})).json(),
    onSuccess: () => {
      refresh();
      toast({ title: "Prize removed" });
    },
  });
  const togglePub = useMutation({
    mutationFn: async (p: Prize) =>
      (
        await apiRequest("PATCH", `/api/bsl/admin/prizes/${p.id}`, {
          isPublished: !p.isPublished,
        })
      ).json(),
    onSuccess: () => refresh(),
  });

  const grouped = useMemo(() => {
    const m = new Map<string, Prize[]>();
    for (const p of prizes) {
      const key = `${p.division || "(All divisions)"} · ${p.category || "Overall"}`;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(p);
    }
    for (const arr of m.values())
      arr.sort((a, b) => a.rank - b.rank || a.sortOrder - b.sortOrder);
    return m;
  }, [prizes]);

  return (
    <AdminLayout active="prizes">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            Year-End <span style={{ color: BSL.gold }}>Prizes</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: BSL.muted }}>
            Set up the prize vault for every division and every category. What
            you save here shows up on the public BSL Prize Vault page.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ActionButton
            variant="ghost"
            icon={<Wand2 className="h-4 w-4" />}
            onClick={() => {
              if (
                confirm(
                  "Seed default prizes for every division × MD/WD/XD × top 3? Existing prizes will be kept — use 'Replace' below to wipe first.",
                )
              )
                seed.mutate(false);
            }}
            disabled={seed.isPending}
          >
            Seed defaults
          </ActionButton>
          <ActionButton
            variant="ghost"
            icon={<Wand2 className="h-4 w-4" />}
            onClick={() => {
              if (
                confirm(
                  "WIPE all current prizes and seed fresh defaults? This cannot be undone.",
                )
              )
                seed.mutate(true);
            }}
            disabled={seed.isPending}
          >
            Wipe + seed
          </ActionButton>
          <ActionButton
            variant="cyan"
            icon={<Plus className="h-4 w-4" />}
            onClick={() => setCreating(true)}
            data-testid="button-new-prize"
          >
            New prize
          </ActionButton>
        </div>
      </div>

      <GlowPanel
        title="Prize vault"
        subtitle={`${prizes.length} prize ${prizes.length === 1 ? "tier" : "tiers"} configured`}
        tone="gold"
        icon={<Trophy className="h-4 w-4" />}
      >
        {isLoading ? (
          <div
            className="py-10 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            Loading…
          </div>
        ) : grouped.size === 0 ? (
          <div
            className="py-10 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            No prizes yet. Hit <strong>Seed defaults</strong> to bootstrap, or{" "}
            <strong>New prize</strong> to add one.
          </div>
        ) : (
          <div className="space-y-6">
            {[...grouped.entries()].map(([key, items]) => (
              <div key={key}>
                <div
                  className="text-[11px] font-black uppercase tracking-[0.22em] mb-2"
                  style={{ color: BSL.cyan }}
                >
                  {key}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {items.map((p) => {
                    const Icon = TIER_ICON[p.tier] || Crown;
                    const tone = TIER_TONE[p.tier] || BSL.gold;
                    return (
                      <div
                        key={p.id}
                        className="rounded-xl p-3 flex items-start gap-3"
                        style={{
                          background: BSL.cardSoft,
                          border: `1px solid ${tone}44`,
                        }}
                        data-testid={`row-prize-${p.id}`}
                      >
                        <div
                          className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0"
                          style={{
                            background: `linear-gradient(140deg, ${tone}, hsl(222,50%,8%))`,
                            border: `1px solid ${tone}66`,
                          }}
                        >
                          <Icon
                            className="h-6 w-6"
                            style={{ color: "white" }}
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="text-[10px] font-black px-1.5 py-0.5 rounded"
                              style={{ background: `${tone}33`, color: tone }}
                            >
                              #{p.rank} · {p.tier}
                            </span>
                            {!p.isPublished && (
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                                style={{
                                  background: "hsla(0,0%,100%,0.08)",
                                  color: BSL.muted,
                                }}
                              >
                                HIDDEN
                              </span>
                            )}
                          </div>
                          <div
                            className="text-sm font-bold mt-1 truncate"
                            title={p.title}
                          >
                            {p.title}
                          </div>
                          <div
                            className="text-xs mt-0.5 line-clamp-2"
                            style={{ color: BSL.muted }}
                          >
                            {p.prizeText}
                          </div>
                          <div className="mt-2 flex gap-1.5 flex-wrap">
                            <button
                              onClick={() => setEditing(p)}
                              className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider"
                              style={{
                                background: `${BSL.cyan}22`,
                                color: BSL.cyan,
                                border: `1px solid ${BSL.cyan}55`,
                              }}
                              data-testid={`button-edit-${p.id}`}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => togglePub.mutate(p)}
                              className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider inline-flex items-center gap-1"
                              style={{
                                background: "hsla(0,0%,100%,0.06)",
                                color: "white",
                                border: `1px solid hsla(0,0%,100%,0.15)`,
                              }}
                            >
                              {p.isPublished ? (
                                <>
                                  <EyeOff className="h-3 w-3" /> Hide
                                </>
                              ) : (
                                <>
                                  <Eye className="h-3 w-3" /> Show
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete "${p.title}"?`))
                                  del.mutate(p.id);
                              }}
                              className="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wider inline-flex items-center gap-1"
                              style={{
                                background: `${BSL.danger}22`,
                                color: BSL.danger,
                                border: `1px solid ${BSL.danger}55`,
                              }}
                              data-testid={`button-delete-${p.id}`}
                            >
                              <Trash2 className="h-3 w-3" /> Del
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </GlowPanel>

      <AnimatePresence>
        {(editing || creating) && (
          <PrizeEditor
            prize={editing}
            divisions={divisions}
            onClose={() => {
              setEditing(null);
              setCreating(false);
            }}
            onSaved={() => {
              refresh();
              setEditing(null);
              setCreating(false);
            }}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}

function PrizeEditor({
  prize,
  divisions,
  onClose,
  onSaved,
}: {
  prize: Prize | null;
  divisions: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    division: prize?.division || "",
    category: prize?.category || "",
    rank: prize?.rank ?? 1,
    tier: prize?.tier || "GOLD",
    title: prize?.title || "",
    subtitle: prize?.subtitle || "",
    prizeText: prize?.prizeText || "",
    prizeAmount:
      prize?.prizeAmountPence != null
        ? (prize.prizeAmountPence / 100).toString()
        : "",
    isPublished: prize?.isPublished !== false,
    sortOrder: prize?.sortOrder ?? 0,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        division: form.division || null,
        category: form.category || null,
        rank: Math.max(1, Math.min(99, Number(form.rank) || 1)),
        tier: form.tier,
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        prizeText: form.prizeText.trim(),
        prizeAmountPence:
          form.prizeAmount === ""
            ? null
            : Math.max(0, Math.round(Number(form.prizeAmount) * 100)),
        isPublished: form.isPublished,
        sortOrder: Number(form.sortOrder) || 0,
      };
      if (!payload.title) throw new Error("Title is required");
      if (!payload.prizeText) throw new Error("Prize text is required");
      if (prize)
        return (
          await apiRequest(
            "PATCH",
            `/api/bsl/admin/prizes/${prize.id}`,
            payload,
          )
        ).json();
      return (
        await apiRequest("POST", "/api/bsl/admin/prizes", payload)
      ).json();
    },
    onSuccess: () => {
      toast({ title: prize ? "Prize updated" : "Prize created" });
      onSaved();
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't save",
        description: clean(e?.message),
        variant: "destructive",
      }),
  });

  const Icon = TIER_ICON[form.tier] || Crown;
  const tone = TIER_TONE[form.tier] || BSL.gold;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-2xl max-h-[92vh] overflow-y-auto p-0"
        style={{
          background: BSL.bgDeep,
          border: `1px solid ${BSL.border}`,
          color: "white",
        }}
      >
        <DialogHeader
          className="px-5 pt-5 pb-3 border-b"
          style={{ borderColor: BSL.border }}
        >
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Trophy className="h-5 w-5" style={{ color: BSL.gold }} />
            {prize ? "Edit prize" : "New prize"}
          </DialogTitle>
        </DialogHeader>

        <div className="p-5 space-y-4">
          {/* Live preview */}
          <div
            className="rounded-xl p-4 flex items-center gap-4"
            style={{ background: BSL.cardSoft, border: `1px solid ${tone}55` }}
          >
            <div
              className="h-16 w-16 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(140deg, ${tone}, hsl(222,50%,8%))`,
                border: `1px solid ${tone}66`,
                boxShadow: `0 8px 24px ${tone}55`,
              }}
            >
              <Icon className="h-8 w-8 text-white" />
            </div>
            <div className="min-w-0">
              <div
                className="text-[10px] font-black uppercase tracking-[0.22em]"
                style={{ color: tone }}
              >
                #{form.rank} · {form.tier}
              </div>
              <div className="font-black text-lg truncate">
                {form.title || "Prize title"}
              </div>
              <div className="text-xs" style={{ color: BSL.muted }}>
                {form.prizeText || "What the winners get…"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Division" hint="Blank = applies across all divisions">
              <select
                value={form.division}
                onChange={(e) => setForm({ ...form, division: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inp()}
                data-testid="select-prize-division"
              >
                <option value="">(All divisions)</option>
                {divisions.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inp()}
                data-testid="select-prize-category"
              >
                {CATS.map((c) => (
                  <option key={c.v} value={c.v}>
                    {c.l}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Rank">
              <input
                type="number"
                min={1}
                max={99}
                value={form.rank}
                onChange={(e) =>
                  setForm({ ...form, rank: Number(e.target.value) || 1 })
                }
                className="w-full px-3 py-2 rounded-lg text-sm tabular-nums"
                style={inp()}
                data-testid="input-prize-rank"
              />
            </Field>
            <Field label="Tier (controls colour + icon)">
              <select
                value={form.tier}
                onChange={(e) => setForm({ ...form, tier: e.target.value })}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inp()}
                data-testid="select-prize-tier"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title" hint="Big bold heading on the card">
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Premier · MD Champions"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inp()}
                data-testid="input-prize-title"
              />
            </Field>
            <Field label="Subtitle (optional)">
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="One-liner under the title"
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={inp()}
                data-testid="input-prize-subtitle"
              />
            </Field>
            <Field label="Prize text" hint="What the winners actually get">
              <textarea
                rows={2}
                value={form.prizeText}
                onChange={(e) =>
                  setForm({ ...form, prizeText: e.target.value })
                }
                placeholder="£500 cash + Champion trophy + BSL jackets"
                className="w-full px-3 py-2 rounded-lg text-sm resize-y"
                style={inp()}
                data-testid="input-prize-text"
              />
            </Field>
            <Field
              label="Prize cash (£, optional)"
              hint="Shown as a chip on the card"
            >
              <input
                type="number"
                min={0}
                step="0.01"
                value={form.prizeAmount}
                onChange={(e) =>
                  setForm({ ...form, prizeAmount: e.target.value })
                }
                placeholder="500"
                className="w-full px-3 py-2 rounded-lg text-sm tabular-nums"
                style={inp()}
                data-testid="input-prize-amount"
              />
            </Field>
            <Field label="Sort order">
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) =>
                  setForm({ ...form, sortOrder: Number(e.target.value) || 0 })
                }
                className="w-full px-3 py-2 rounded-lg text-sm tabular-nums"
                style={inp()}
              />
            </Field>
            <Field label="Visibility">
              <label
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer"
                style={inp()}
              >
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) =>
                    setForm({ ...form, isPublished: e.target.checked })
                  }
                  data-testid="check-prize-published"
                />
                <span>
                  {form.isPublished
                    ? "Published — shown publicly"
                    : "Hidden — admin only"}
                </span>
              </label>
            </Field>
          </div>

          <div
            className="flex justify-end gap-2 pt-4 border-t"
            style={{ borderColor: BSL.border }}
          >
            <ActionButton variant="ghost" onClick={onClose}>
              Cancel
            </ActionButton>
            <ActionButton
              variant="gold"
              loading={save.isPending}
              onClick={() => save.mutate()}
              icon={<Trophy className="h-4 w-4" />}
              data-testid="button-save-prize"
            >
              {prize ? "Save changes" : "Create prize"}
            </ActionButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[10px] uppercase tracking-widest font-bold block mb-1"
        style={{ color: BSL.muted }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div className="text-[10px] mt-1" style={{ color: BSL.faint }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function inp(): React.CSSProperties {
  return {
    background: BSL.bgDeep,
    border: `1px solid ${BSL.border}`,
    color: "white",
  };
}
