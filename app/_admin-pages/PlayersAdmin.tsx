import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "@/lib/routing";
import {
  Users,
  Search,
  ShieldOff,
  AlertTriangle,
  X,
  Save,
  Wallet as WalletIcon,
  UserPlus,
  Zap,
  Plus,
  Minus,
  Tag,
  Layers,
  Award,
  ArrowRightLeft,
  Trash2,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { CreatePlayerDialog } from "./PlayerCreateDialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const STATUS_COLOR: any = {
  PENDING_PAYMENT: BSL.muted,
  PENDING_VERIFICATION: BSL.gold,
  ACTIVE: BSL.success,
  REJECTED: BSL.danger,
};
const CATS = ["MD", "WD", "XD"] as const;

export default function PlayersAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [clubFilter, setClubFilter] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const { data: clubs } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/clubs"],
  });
  const { data: players } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/players", statusFilter, clubFilter, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (clubFilter) params.set("clubId", clubFilter);
      if (q) params.set("q", q);
      const r = await fetch(`/api/bsl/admin/players?${params.toString()}`, {
        credentials: "include",
      });
      return r.json();
    },
  });
  const editing = useMemo(
    () => (players || []).find((p: any) => p.id === editId),
    [players, editId],
  );

  const invAll = () => {
    qc.invalidateQueries({ queryKey: ["/api/bsl/admin/players"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/admin/dashboard"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] });
    // Broader admin surfaces that show roster / pair / membership data —
    // a delete or transfer from here also changes those views.
    qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/players"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/my-club"] });
  };

  const update = useMutation({
    mutationFn: async (v: { id: number; data: any }) => {
      // Coerce empty-string FK ids → null so Postgres doesn't reject them.
      const clean = { ...v.data };
      if (clean.bslClubId === "") clean.bslClubId = null;
      if (clean.bslTeamId === "") clean.bslTeamId = null;
      return (
        await apiRequest("PATCH", `/api/bsl/admin/players/${v.id}`, clean)
      ).json();
    },
    onSuccess: () => {
      invAll();
      toast({ title: "Saved" });
    },
    onError: (e: any) =>
      toast({
        title: "Save failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });
  const approve = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/bsl/players/${id}/approve`, {})).json(),
    onSuccess: () => {
      invAll();
      toast({ title: "Player approved" });
    },
  });

  return (
    <AdminLayout active="players">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            Players <span style={{ color: BSL.cyan }}>Database</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: BSL.muted }}>
            Create on behalf · approve · activate · adjust wallets · assign
            categories · stats correction
          </p>
        </div>
        <ActionButton
          variant="cyan"
          icon={<UserPlus className="h-3 w-3" />}
          onClick={() => setCreating(true)}
          testid="button-create-player"
        >
          Create player
        </ActionButton>
      </div>

      <GlowPanel
        title={`${players?.length ?? 0} players`}
        tone="cyan"
        icon={<Users className="h-4 w-4" />}
      >
        <div className="flex flex-wrap gap-2 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3"
              style={{ color: BSL.muted }}
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-player-search"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="select-player-status"
          >
            <option value="">All statuses</option>
            <option value="PENDING_PAYMENT">Pending payment</option>
            <option value="PENDING_VERIFICATION">Pending verification</option>
            <option value="ACTIVE">Active</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="select-player-club"
          >
            <option value="">All clubs</option>
            {(clubs || []).map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {!players?.length ? (
          <div
            className="py-10 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            No players match those filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: BSL.muted }}
                >
                  <th className="text-left px-2 py-2">Player</th>
                  <th className="text-left px-2 py-2">Club</th>
                  <th className="text-left px-2 py-2">Status</th>
                  <th className="text-left px-2 py-2">Grade</th>
                  <th className="text-left px-2 py-2">Categories</th>
                  <th className="text-left px-2 py-2">Wallet</th>
                  <th className="text-left px-2 py-2">P / W</th>
                  <th className="text-right px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {players.map((p: any, i: number) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.015 }}
                    className="border-t"
                    style={{ borderColor: BSL.border }}
                    data-testid={`row-player-${p.id}`}
                  >
                    <td className="px-2 py-3">
                      <div className="font-bold">{p.displayName}</div>
                      <div className="text-[10px]" style={{ color: BSL.faint }}>
                        {p.email || `#${p.userId}`} · {p.paymentReference}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-xs">
                      {(clubs || []).find((c: any) => c.id === p.bslClubId)
                        ?.name || <span style={{ color: BSL.faint }}>—</span>}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className="text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded"
                        style={{
                          background: `${STATUS_COLOR[p.status]}22`,
                          color: STATUS_COLOR[p.status],
                        }}
                      >
                        {p.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-2 py-3">
                      {p.grade ? (
                        <span
                          className="text-[10px] font-black px-1.5 py-0.5 rounded font-mono"
                          style={{
                            background: `${BSL.gold}22`,
                            color: BSL.gold,
                          }}
                          data-testid={`text-grade-${p.id}`}
                        >
                          {p.grade}
                        </span>
                      ) : (
                        <span
                          className="text-[10px]"
                          style={{ color: BSL.faint }}
                        >
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {(p.categories || []).length === 0 ? (
                          <span
                            className="text-[10px]"
                            style={{ color: BSL.faint }}
                          >
                            —
                          </span>
                        ) : (
                          (p.categories || []).map((c: string) => (
                            <span
                              key={c}
                              className="text-[10px] font-black px-1.5 py-0.5 rounded"
                              style={{
                                background: `${BSL.cyan}22`,
                                color: BSL.cyan,
                              }}
                            >
                              {c}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td
                      className="px-2 py-3 tabular-nums"
                      style={{ color: BSL.gold }}
                    >
                      £{(p.walletBalance / 100).toFixed(2)}
                    </td>
                    <td className="px-2 py-3 tabular-nums">
                      {p.matchesPlayed} / {p.matchesWon}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {p.status === "PENDING_VERIFICATION" && (
                          <ActionButton
                            variant="cyan"
                            onClick={() => approve.mutate(p.id)}
                          >
                            Approve
                          </ActionButton>
                        )}
                        <ActionButton
                          variant="gold"
                          onClick={() => setEditId(p.id)}
                        >
                          Edit
                        </ActionButton>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlowPanel>

      {creating && (
        <CreatePlayerDialog
          clubs={clubs || []}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            invAll();
          }}
        />
      )}
      {editing && (
        <PlayerEditor
          player={editing}
          clubs={clubs || []}
          onClose={() => setEditId(null)}
          onSave={(data: any) =>
            update
              .mutateAsync({ id: editing.id, data })
              .then(() => setEditId(null))
              .catch(() => {
                /* toast already shown */
              })
          }
          onChanged={invAll}
        />
      )}
    </AdminLayout>
  );
}

// ---------------------------------------------------------------------------
// PLAYER EDITOR — extended with force-activate, wallet adjust, categories
// ---------------------------------------------------------------------------
function PlayerEditor({ player, clubs, onClose, onSave, onChanged }: any) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    bslClubId: player.bslClubId || "",
    bslTeamId: player.bslTeamId || "",
    matchesPlayed: player.matchesPlayed,
    matchesWon: player.matchesWon,
    pointsScored: player.pointsScored,
    warnings: player.warnings,
    matchBanCount: player.matchBanCount,
    isSuspended: player.isSuspended,
    disciplineNotes: player.disciplineNotes || "",
  });
  // Local mirror so we can reflect server-side changes (activate / wallet / cats)
  // without forcing a full refetch round-trip before showing the new state.
  const [live, setLive] = useState(player);
  useEffect(() => {
    setLive(player);
  }, [
    player.id,
    player.status,
    player.walletBalance,
    player.categories?.join(","),
  ]);

  const { data: teams } = useQuery<any[]>({
    queryKey: ["/api/bsl/clubs", form.bslClubId, "teams"],
    queryFn: async () =>
      form.bslClubId
        ? (
            await fetch(`/api/bsl/clubs/${form.bslClubId}/teams`, {
              credentials: "include",
            })
          ).json()
        : [],
    enabled: !!form.bslClubId,
  });

  const activate = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "POST",
          `/api/bsl/admin/players/${player.id}/activate`,
          {},
        )
      ).json(),
    onSuccess: (d: any) => {
      setLive(d);
      onChanged?.();
      toast({ title: "Player activated" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  const [adjAmt, setAdjAmt] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const adjustWallet = useMutation({
    mutationFn: async (sign: 1 | -1) => {
      const pence = Math.trunc(Number(adjAmt) * 100) * sign;
      return (
        await apiRequest(
          "POST",
          `/api/bsl/admin/players/${player.id}/wallet/adjust`,
          { amount: pence, note: adjNote },
        )
      ).json();
    },
    onSuccess: (d: any) => {
      setLive(d);
      setAdjAmt("");
      setAdjNote("");
      onChanged?.();
      toast({
        title: "Wallet updated",
        description: `New balance £${(d.walletBalance / 100).toFixed(2)}`,
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  const addCat = useMutation({
    mutationFn: async (cat: string) =>
      (
        await apiRequest(
          "POST",
          `/api/bsl/admin/players/${player.id}/categories`,
          { category: cat },
        )
      ).json(),
    onSuccess: (d: any) => {
      setLive(d);
      onChanged?.();
      toast({ title: "Category added" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });
  const removeCat = useMutation({
    mutationFn: async (cat: string) =>
      (
        await apiRequest(
          "DELETE",
          `/api/bsl/admin/players/${player.id}/categories/${cat}`,
        )
      ).json(),
    onSuccess: (d: any) => {
      setLive(d);
      onChanged?.();
      toast({ title: "Category removed" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  const liveCats: string[] = live.categories || [];

  // Grade picker — uses the admin-defined grade catalogue from the league.
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const allGrades: Array<{ code: string; label: string }> = Array.isArray(
    league?.playerGrades,
  )
    ? league.playerGrades
    : [];
  const setGrade = useMutation({
    mutationFn: async (g: string | null) =>
      (
        await apiRequest("PATCH", `/api/bsl/players/${player.id}/grade`, {
          grade: g,
        })
      ).json(),
    onSuccess: (d: any) => {
      setLive(d);
      onChanged?.();
      toast({ title: "Grade updated" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  // Transfer to another club (across divisions). Locked if matchesPlayed > 0
  // or the player is in any pair. The server is the source of truth — we
  // optimistically only enable when matchesPlayed === 0.
  const [transferTo, setTransferTo] = useState<string>("");
  const canTransfer = (live.matchesPlayed ?? 0) === 0;
  const transferable = clubs.filter((c: any) => c.id !== live.bslClubId);
  const transfer = useMutation({
    mutationFn: async (toBslClubId: number) =>
      (
        await apiRequest(
          "POST",
          `/api/bsl/admin/players/${player.id}/transfer`,
          { toBslClubId },
        )
      ).json(),
    onSuccess: (d: any) => {
      setLive(d);
      setForm((f: any) => ({ ...f, bslClubId: d.bslClubId, bslTeamId: "" }));
      setTransferTo("");
      onChanged?.();
      toast({
        title: "Player transferred",
        description: "New club must re-confirm them.",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Transfer blocked",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  // Hard-delete (admin only). User account is untouched — the same user can
  // be re-added to BSL afterwards via "Create player".
  const [confirmDelete, setConfirmDelete] = useState(false);
  const deletePlayer = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("DELETE", `/api/bsl/admin/players/${player.id}`)
      ).json(),
    onSuccess: () => {
      onChanged?.();
      toast({
        title: "Player removed from BSL",
        description:
          "Their user account is unchanged — you can re-add them anytime.",
      });
      onClose();
    },
    onError: (e: any) =>
      toast({
        title: "Delete blocked",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "hsla(222,60%,2%,0.85)",
        backdropFilter: "blur(8px)",
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{
          background: BSL.card,
          border: `1px solid ${BSL.cyan}55`,
          boxShadow: `0 24px 64px hsla(222,80%,2%,0.6), 0 0 0 1px ${BSL.cyan}22`,
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="dialog-edit-player"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black uppercase tracking-tight">
            Edit · <span style={{ color: BSL.cyan }}>{player.displayName}</span>
          </h3>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded"
              style={{
                background: `${STATUS_COLOR[live.status]}22`,
                color: STATUS_COLOR[live.status],
              }}
            >
              {live.status.replace("_", " ")}
            </span>
            <button
              onClick={onClose}
              className="p-1.5 rounded"
              style={{ background: BSL.cardSoft }}
              data-testid="button-close-player"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {live.status !== "ACTIVE" && (
          <Section title="Force-activate (skip payment)">
            <div
              className="flex items-center justify-between p-3 rounded-lg"
              style={{
                background: `${BSL.success}11`,
                border: `1px solid ${BSL.success}55`,
              }}
            >
              <div className="text-xs" style={{ color: BSL.muted }}>
                Skips wallet check + verification queue. Player goes straight to
                ACTIVE.
              </div>
              <ActionButton
                variant="cyan"
                icon={<Zap className="h-3 w-3" />}
                onClick={() => activate.mutate()}
                disabled={activate.isPending}
                testid="button-force-activate"
              >
                {activate.isPending ? "Activating…" : "Activate"}
              </ActionButton>
            </div>
          </Section>
        )}

        <Section
          title={
            <>
              Wallet ·{" "}
              <span style={{ color: BSL.gold }}>
                £{(live.walletBalance / 100).toFixed(2)}
              </span>
            </>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_2fr_auto_auto] gap-2 items-stretch">
            <input
              type="number"
              step="0.01"
              min="0"
              value={adjAmt}
              onChange={(e) => setAdjAmt(e.target.value)}
              placeholder="Amount £"
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-wallet-amount"
            />
            <input
              value={adjNote}
              onChange={(e) => setAdjNote(e.target.value)}
              placeholder="Reason (optional)"
              className="px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-wallet-note"
            />
            <button
              onClick={() => adjustWallet.mutate(1)}
              disabled={
                !adjAmt || Number(adjAmt) <= 0 || adjustWallet.isPending
              }
              className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest inline-flex items-center gap-1 disabled:opacity-40"
              style={{
                background: `${BSL.success}22`,
                color: BSL.success,
                border: `1px solid ${BSL.success}55`,
              }}
              data-testid="button-wallet-add"
            >
              <Plus className="h-3 w-3" /> Credit
            </button>
            <button
              onClick={() => adjustWallet.mutate(-1)}
              disabled={
                !adjAmt || Number(adjAmt) <= 0 || adjustWallet.isPending
              }
              className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest inline-flex items-center gap-1 disabled:opacity-40"
              style={{
                background: `${BSL.danger}22`,
                color: BSL.danger,
                border: `1px solid ${BSL.danger}55`,
              }}
              data-testid="button-wallet-deduct"
            >
              <Minus className="h-3 w-3" /> Deduct
            </button>
          </div>
          <div className="text-[10px] mt-2" style={{ color: BSL.faint }}>
            Writes a properly-typed ledger row + audit log. Atomic.
          </div>
        </Section>

        <Section title="Categories">
          <div className="flex flex-wrap gap-2">
            {CATS.map((cat) => {
              const on = liveCats.includes(cat);
              const busy = addCat.isPending || removeCat.isPending;
              return (
                <button
                  key={cat}
                  disabled={busy}
                  onClick={() =>
                    on ? removeCat.mutate(cat) : addCat.mutate(cat)
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-50"
                  style={{
                    background: on ? `${BSL.cyan}22` : BSL.cardSoft,
                    color: on ? BSL.cyan : BSL.muted,
                    border: `1px solid ${on ? BSL.cyan : BSL.border}`,
                  }}
                  data-testid={`toggle-cat-${cat}`}
                >
                  <Tag className="h-3 w-3" /> {cat} {on ? "✓" : ""}
                </button>
              );
            })}
          </div>
          <div className="text-[10px] mt-2" style={{ color: BSL.faint }}>
            Admin override: no fee charged, no balance check.
          </div>
        </Section>

        <Section
          title={
            <>
              Grade ·{" "}
              <span className="font-mono" style={{ color: BSL.gold }}>
                {live.grade || "ungraded"}
              </span>
            </>
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {allGrades.length === 0 && (
              <div className="text-[10px]" style={{ color: BSL.faint }}>
                No grades configured. Set them under League Settings → Player
                Grades.
              </div>
            )}
            {allGrades.map((g) => {
              const on = live.grade === g.code;
              return (
                <button
                  key={g.code}
                  disabled={setGrade.isPending}
                  onClick={() => setGrade.mutate(on ? null : g.code)}
                  className="px-2 py-1 rounded-md text-[11px] font-black uppercase tracking-widest font-mono disabled:opacity-50"
                  style={{
                    background: on ? `${BSL.gold}33` : BSL.cardSoft,
                    color: on ? BSL.gold : BSL.muted,
                    border: `1px solid ${on ? BSL.gold : BSL.border}`,
                  }}
                  data-testid={`toggle-grade-${g.code}`}
                >
                  <Award className="h-3 w-3 inline -mt-0.5 mr-1" /> {g.code}
                </button>
              );
            })}
            {live.grade && (
              <button
                disabled={setGrade.isPending}
                onClick={() => setGrade.mutate(null)}
                className="px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-widest disabled:opacity-50"
                style={{
                  background: `${BSL.danger}1f`,
                  color: BSL.danger,
                  border: `1px solid ${BSL.danger}55`,
                }}
                data-testid="button-grade-clear"
              >
                Clear
              </button>
            )}
          </div>
          <div className="text-[10px] mt-2" style={{ color: BSL.faint }}>
            Per-division eligibility is enforced on club join + admin create.
          </div>
        </Section>

        <Section title="Transfer to another club">
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <select
              value={transferTo}
              onChange={(e) => setTransferTo(e.target.value)}
              disabled={!canTransfer}
              className="px-3 py-2 rounded-lg text-sm disabled:opacity-50"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="select-transfer-club"
            >
              <option value="">— Pick destination club —</option>
              {transferable.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.division}
                </option>
              ))}
            </select>
            <button
              disabled={!canTransfer || !transferTo || transfer.isPending}
              onClick={() => transfer.mutate(Number(transferTo))}
              className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest inline-flex items-center gap-1 disabled:opacity-40"
              style={{
                background: `${BSL.cyan}22`,
                color: BSL.cyan,
                border: `1px solid ${BSL.cyan}55`,
              }}
              data-testid="button-transfer-player"
            >
              <ArrowRightLeft className="h-3 w-3" />{" "}
              {transfer.isPending ? "Transferring…" : "Transfer"}
            </button>
          </div>
          <div
            className="text-[10px] mt-2"
            style={{ color: canTransfer ? BSL.faint : BSL.danger }}
          >
            {canTransfer
              ? "Allowed only when the player has zero matches played and isn't in a pair lineup."
              : `Locked — player has ${live.matchesPlayed ?? 0} match record(s) this season.`}
          </div>
        </Section>

        <Section title="Assignment">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Club">
              <select
                value={form.bslClubId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bslClubId: e.target.value ? Number(e.target.value) : "",
                    bslTeamId: "",
                  })
                }
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                  color: "white",
                }}
                data-testid="select-edit-club"
              >
                <option value="">— Unassigned —</option>
                {clubs.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Pair">
              <select
                value={form.bslTeamId}
                onChange={(e) =>
                  setForm({
                    ...form,
                    bslTeamId: e.target.value ? Number(e.target.value) : "",
                  })
                }
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                  color: "white",
                }}
                data-testid="select-edit-team"
              >
                <option value="">— None —</option>
                {(teams || []).map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          {form.bslClubId && (
            <Link href={`/admin/clubs/${form.bslClubId}/manage`}>
              <a
                className="inline-flex items-center gap-1.5 mt-2 text-xs font-bold underline"
                style={{ color: BSL.cyan }}
                data-testid="link-manage-club"
              >
                <Layers className="h-3 w-3" /> Manage roster + pairs for this
                club
              </a>
            </Link>
          )}
        </Section>

        <Section title="Stats correction">
          <div className="grid grid-cols-3 gap-3">
            <NumField
              label="Played"
              value={form.matchesPlayed}
              onChange={(v: number) => setForm({ ...form, matchesPlayed: v })}
              testid="input-played"
            />
            <NumField
              label="Won"
              value={form.matchesWon}
              onChange={(v: number) => setForm({ ...form, matchesWon: v })}
              testid="input-won"
            />
            <NumField
              label="Points"
              value={form.pointsScored}
              onChange={(v: number) => setForm({ ...form, pointsScored: v })}
              testid="input-points"
            />
          </div>
        </Section>

        <Section title="Discipline">
          <div className="grid grid-cols-2 gap-3">
            <NumField
              label="Warnings"
              value={form.warnings}
              onChange={(v: number) => setForm({ ...form, warnings: v })}
              testid="input-warnings"
            />
            <NumField
              label="Match bans"
              value={form.matchBanCount}
              onChange={(v: number) => setForm({ ...form, matchBanCount: v })}
              testid="input-bans"
            />
          </div>
          <button
            onClick={() => setForm({ ...form, isSuspended: !form.isSuspended })}
            className="flex items-center justify-between p-3 rounded-lg text-sm font-bold w-full mt-3"
            style={{
              background: form.isSuspended ? `${BSL.danger}22` : BSL.cardSoft,
              border: `1px solid ${form.isSuspended ? BSL.danger : BSL.border}`,
              color: form.isSuspended ? BSL.danger : BSL.muted,
            }}
            data-testid="toggle-suspend-player"
          >
            <span className="inline-flex items-center gap-2">
              <ShieldOff className="h-3.5 w-3.5" /> Suspended from league
            </span>
            {form.isSuspended ? "ON" : "OFF"}
          </button>
          <Field label="Discipline notes">
            <textarea
              value={form.disciplineNotes}
              onChange={(e) =>
                setForm({ ...form, disciplineNotes: e.target.value })
              }
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none mt-3"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="textarea-discipline"
            />
          </Field>
        </Section>

        <Section title="Danger zone">
          <div
            className="p-3 rounded-lg"
            style={{
              background: `${BSL.danger}11`,
              border: `1px solid ${BSL.danger}55`,
            }}
          >
            <div className="flex items-start gap-2 mb-2">
              <AlertTriangle
                className="h-4 w-4 flex-shrink-0 mt-0.5"
                style={{ color: BSL.danger }}
              />
              <div className="text-[11px]" style={{ color: BSL.muted }}>
                Remove this player's BSL profile entirely. Their user account
                stays — you can re-add them to any club afterwards via{" "}
                <strong style={{ color: BSL.cyan }}>Create player</strong>.
                Wallet history, pair assignments and team-member rows are
                deleted. Blocked if the player has any match record this season
                — use <strong>Transfer</strong> or clear their stats first.
              </div>
            </div>
            {!confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest inline-flex items-center justify-center gap-1"
                style={{
                  background: `${BSL.danger}22`,
                  color: BSL.danger,
                  border: `1px solid ${BSL.danger}55`,
                }}
                data-testid="button-delete-player"
              >
                <Trash2 className="h-3 w-3" /> Remove from BSL
              </button>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  disabled={deletePlayer.isPending}
                  className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                  style={{ background: BSL.cardSoft, color: BSL.muted }}
                  data-testid="button-delete-cancel"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deletePlayer.mutate()}
                  disabled={deletePlayer.isPending}
                  className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest inline-flex items-center justify-center gap-1 disabled:opacity-50"
                  style={{
                    background: BSL.danger,
                    color: "white",
                    border: `1px solid ${BSL.danger}`,
                  }}
                  data-testid="button-delete-confirm"
                >
                  <Trash2 className="h-3 w-3" />{" "}
                  {deletePlayer.isPending ? "Removing…" : "Yes, remove"}
                </button>
              </div>
            )}
          </div>
        </Section>

        <div className="flex justify-end gap-2 pt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: BSL.cardSoft, color: BSL.muted }}
            data-testid="button-cancel-player"
          >
            Close
          </button>
          <ActionButton
            variant="cyan"
            onClick={() => onSave(form)}
            icon={<Save className="h-3 w-3" />}
          >
            Save other changes
          </ActionButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="mb-4">
      <div
        className="text-[10px] uppercase tracking-widest font-black mb-2"
        style={{ color: BSL.cyan }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: any) {
  return (
    <div>
      <label
        className="text-[10px] uppercase tracking-widest font-bold block mb-1"
        style={{ color: BSL.muted }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
function NumField({ label, value, onChange, testid }: any) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full px-3 py-2 rounded-lg text-sm tabular-nums"
        style={{
          background: BSL.cardSoft,
          border: `1px solid ${BSL.border}`,
          color: "white",
        }}
        data-testid={testid}
      />
    </Field>
  );
}
