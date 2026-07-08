import { useMemo, useState } from "react";
import { useParams, Link } from "@/lib/routing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Users,
  CheckCircle2,
  X,
  Plus,
  UserMinus,
  Pencil,
  Save,
  UserPlus,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { MatchPairsManager } from "@/components/bsl/MatchPairsManager";
import { CreatePlayerDialog } from "./PlayerCreateDialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

// Admin-only: roster + pair manager for any club. Reuses the manager endpoints
// (which already accept admin via loadClubForManager) — only the read endpoint
// (`/api/bsl/admin/clubs/:id/manager-view`) is admin-specific so super admins
// can step into any club without being its managerUserId.
export default function AdminClubManager() {
  const { id: idStr } = useParams<{ id: string }>();
  const clubId = Number(idStr);
  const qc = useQueryClient();
  const { toast } = useToast();

  const queryKey = ["/api/bsl/admin/clubs", clubId, "manager-view"];
  const { data, isLoading } = useQuery<any>({
    queryKey,
    queryFn: async () =>
      (
        await fetch(`/api/bsl/admin/clubs/${clubId}/manager-view`, {
          credentials: "include",
        })
      ).json(),
    enabled: Number.isFinite(clubId),
  });
  const inv = () => qc.invalidateQueries({ queryKey });

  const confirm = useMutation({
    mutationFn: async (playerId: number) =>
      (
        await apiRequest(
          "POST",
          `/api/bsl/clubs/${clubId}/players/${playerId}/confirm`,
          {},
        )
      ).json(),
    onSuccess: () => {
      inv();
      toast({ title: "Player confirmed" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });
  const remove = useMutation({
    mutationFn: async (playerId: number) =>
      (
        await apiRequest(
          "DELETE",
          `/api/bsl/clubs/${clubId}/players/${playerId}`,
        )
      ).json(),
    onSuccess: () => {
      inv();
      toast({ title: "Player removed" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });
  // League grade catalogue (for the player editor's grade picker) + the full
  // clubs list (so the Create Player dialog can pre-select THIS club).
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const playerGrades: Array<{ code: string; label?: string }> = Array.isArray(
    league?.playerGrades,
  )
    ? league.playerGrades
    : [];
  const { data: clubs } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/clubs"],
  });

  const roster: any[] = data?.confirmed || [];
  const pending: any[] = data?.pending || [];
  const club = data?.club;

  // Add / edit player state. Edit saves through the club-scoped manager
  // endpoint (super-admin is authorised via loadClubForManager), which already
  // handles display name, within-club division switch, categories and grade.
  const [creating, setCreating] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [playerForm, setPlayerForm] = useState<{
    displayName: string;
    bio: string;
    division: string;
    categories: string[];
    grade: string;
  }>({ displayName: "", bio: "", division: "", categories: [], grade: "" });
  const openEdit = (p: any) => {
    setEditingPlayer(p);
    setPlayerForm({
      displayName: p.displayName || "",
      bio: p.bio || "",
      division: p.division || club?.division || "",
      categories: Array.isArray(p.categories) ? [...p.categories] : [],
      grade: p.grade || "",
    });
  };
  const savePlayer = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "PATCH",
          `/api/bsl/clubs/${clubId}/players/${editingPlayer.id}`,
          playerForm,
        )
      ).json(),
    onSuccess: () => {
      inv();
      setEditingPlayer(null);
      toast({ title: "Player updated" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  // Every division the club has joined (primary + paid extras). Each one gets
  // its own per-category pairs panel below, matching the public ClubManager.
  const joinedDivisions = useMemo<string[]>(() => {
    if (!club) return [];
    const extras = Array.isArray(club.additionalDivisions)
      ? [...club.additionalDivisions].sort((a: string, b: string) =>
          a.localeCompare(b),
        )
      : [];
    return [
      club.division,
      ...extras.filter((d: string) => d !== club.division),
    ];
  }, [club]);

  if (isLoading)
    return (
      <AdminLayout active="clubs">
        <div className="py-20 text-center text-sm" style={{ color: BSL.muted }}>
          Loading…
        </div>
      </AdminLayout>
    );
  if (!club)
    return (
      <AdminLayout active="clubs">
        <div className="py-20 text-center text-sm" style={{ color: BSL.muted }}>
          Club not found.
        </div>
      </AdminLayout>
    );

  return (
    <AdminLayout active="clubs">
      <div className="mb-6">
        <Link href="/admin/clubs">
          <a
            className="inline-flex items-center gap-1 text-xs uppercase tracking-widest mb-2"
            style={{ color: BSL.muted }}
            data-testid="link-back-clubs"
          >
            <ArrowLeft className="h-3 w-3" /> Back to clubs
          </a>
        </Link>
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
              Manage <span style={{ color: BSL.gold }}>{club.name}</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: BSL.muted }}>
              {club.division} · {data?.summary?.roster ?? 0} confirmed ·{" "}
              {data?.summary?.pending ?? 0} pending ·{" "}
              {data?.summary?.pairs ?? 0} pairs
            </p>
          </div>
          <ActionButton
            variant="cyan"
            icon={<UserPlus className="h-3 w-3" />}
            onClick={() => setCreating(true)}
            testid="button-create-player"
          >
            Add player
          </ActionButton>
        </div>
      </div>

      {pending.length > 0 && (
        <GlowPanel
          title={`${pending.length} pending join request${pending.length === 1 ? "" : "s"}`}
          tone="gold"
          icon={<Users className="h-4 w-4" />}
        >
          <div className="space-y-2">
            {pending.map((p: any) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-lg"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                }}
                data-testid={`row-pending-${p.id}`}
              >
                <div>
                  <div className="font-bold text-sm">
                    {p.displayName || p.user?.name || `Player #${p.id}`}
                  </div>
                  <div className="text-[10px]" style={{ color: BSL.faint }}>
                    {p.user?.email || `user #${p.userId}`}
                  </div>
                </div>
                <div className="flex gap-1">
                  <ActionButton
                    variant="cyan"
                    icon={<CheckCircle2 className="h-3 w-3" />}
                    onClick={() => confirm.mutate(p.id)}
                    disabled={confirm.isPending}
                    testid={`button-confirm-${p.id}`}
                  >
                    Confirm
                  </ActionButton>
                  <ActionButton
                    variant="ghost"
                    icon={<X className="h-3 w-3" />}
                    onClick={() => {
                      if (window.confirm("Remove this player from the club?"))
                        remove.mutate(p.id);
                    }}
                    testid={`button-reject-${p.id}`}
                  >
                    Remove
                  </ActionButton>
                </div>
              </div>
            ))}
          </div>
        </GlowPanel>
      )}

      {/* Roster — one table per joined division. Players with NULL division
          fall back to the club's primary division so legacy rows still show. */}
      {(joinedDivisions.length > 0 ? joinedDivisions : [club.division]).map(
        (div) => {
          const divRoster = roster.filter(
            (p: any) => (p.division || club.division) === div,
          );
          return (
            <GlowPanel
              key={`roster-${div}`}
              title={`${div} — Roster (${divRoster.length})`}
              tone="cyan"
              icon={<Users className="h-4 w-4" />}
            >
              {divRoster.length === 0 ? (
                <div
                  className="py-6 text-center text-sm"
                  style={{ color: BSL.muted }}
                >
                  No confirmed players in {div} yet.
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
                        <th className="text-left px-2 py-2">Status</th>
                        <th className="text-left px-2 py-2">Categories</th>
                        <th className="text-left px-2 py-2">Wallet</th>
                        <th className="text-left px-2 py-2">P / W</th>
                        <th className="text-right px-2 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {divRoster.map((p: any) => (
                        <tr
                          key={p.id}
                          className="border-t"
                          style={{ borderColor: BSL.border }}
                          data-testid={`roster-${p.id}`}
                        >
                          <td className="px-2 py-3">
                            <div className="font-bold">
                              {p.displayName ||
                                p.user?.name ||
                                `Player #${p.id}`}
                            </div>
                            <div
                              className="text-[10px]"
                              style={{ color: BSL.faint }}
                            >
                              {p.user?.email || `user #${p.userId}`}
                            </div>
                          </td>
                          <td className="px-2 py-3">
                            <span
                              className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded"
                              style={{
                                background:
                                  p.status === "ACTIVE"
                                    ? `${BSL.success}22`
                                    : `${BSL.muted}22`,
                                color:
                                  p.status === "ACTIVE"
                                    ? BSL.success
                                    : BSL.muted,
                              }}
                            >
                              {p.status.replace("_", " ")}
                            </span>
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
                            <div className="inline-flex gap-1">
                              <ActionButton
                                variant="cyan"
                                icon={<Pencil className="h-3 w-3" />}
                                onClick={() => openEdit(p)}
                                testid={`button-edit-roster-${p.id}`}
                              >
                                Edit
                              </ActionButton>
                              <ActionButton
                                variant="ghost"
                                icon={<UserMinus className="h-3 w-3" />}
                                onClick={() => {
                                  if (
                                    window.confirm(
                                      "Remove this player from the club?",
                                    )
                                  )
                                    remove.mutate(p.id);
                                }}
                                testid={`button-remove-roster-${p.id}`}
                              >
                                Remove
                              </ActionButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </GlowPanel>
          );
        },
      )}

      {/* Match-specific pairs — pick a match and build its pairs */}
      <MatchPairsManager
        clubId={clubId}
        roster={roster}
        primaryDivision={club.division}
      />

      {/* Add player — reuses the admin Create Player dialog, pre-set to this club. */}
      {creating && (
        <CreatePlayerDialog
          clubs={clubs || []}
          defaultClubId={clubId}
          defaultDivision={club.division}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            inv();
          }}
        />
      )}

      {/* Edit player — display name, division (within club), categories, grade, bio. */}
      {editingPlayer && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          onClick={() => setEditingPlayer(null)}
        >
          <motion.div
            className="w-full max-w-md rounded-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ background: BSL.card, border: `1px solid ${BSL.cyan}55` }}
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            data-testid="modal-edit-player"
          >
            <div className="flex items-center gap-3 mb-4">
              <Pencil className="h-5 w-5" style={{ color: BSL.cyan }} />
              <h3 className="text-lg font-bold">
                Edit{" "}
                {editingPlayer.displayName ||
                  editingPlayer.user?.name ||
                  "player"}
              </h3>
            </div>

            <div>
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: BSL.muted }}
              >
                Display name (shown on leaderboard)
              </span>
              <input
                value={playerForm.displayName}
                onChange={(e) =>
                  setPlayerForm({ ...playerForm, displayName: e.target.value })
                }
                className="w-full px-3 py-2 rounded-lg text-sm mt-1"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                  color: "white",
                }}
                data-testid="input-edit-player-display"
              />
            </div>

            {joinedDivisions.length > 1 && (
              <div className="mt-3">
                <span
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: BSL.muted }}
                >
                  Division
                </span>
                <select
                  value={playerForm.division}
                  onChange={(e) =>
                    setPlayerForm({ ...playerForm, division: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm mt-1"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                    color: "white",
                  }}
                  data-testid="select-edit-player-division"
                >
                  {joinedDivisions.map((d) => (
                    <option
                      key={d}
                      value={d}
                      style={{ background: BSL.card, color: "white" }}
                    >
                      {d}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] mt-1" style={{ color: BSL.muted }}>
                  Player must not be in a pair to switch divisions — remove them
                  from pairs first.
                </p>
              </div>
            )}

            <div className="mt-3">
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: BSL.muted }}
              >
                Categories
              </span>
              <div className="flex flex-wrap gap-2 mt-1">
                {(["MS", "WS", "MD", "WD", "XD"] as const).map((cat) => {
                  const on = playerForm.categories.includes(cat);
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() =>
                        setPlayerForm((f) => ({
                          ...f,
                          categories: on
                            ? f.categories.filter((c) => c !== cat)
                            : [...f.categories, cat],
                        }))
                      }
                      className="text-[11px] font-black px-2.5 py-1 rounded-md uppercase tracking-widest transition"
                      style={{
                        background: on ? `${BSL.cyan}33` : BSL.cardSoft,
                        color: on ? BSL.cyan : BSL.muted,
                        border: `1px solid ${on ? BSL.cyan : BSL.border}`,
                      }}
                      data-testid={`toggle-edit-player-cat-${cat}`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] mt-1" style={{ color: BSL.muted }}>
                Removing a category they're paired in will also strip them from
                those pairs.
              </p>
            </div>

            {playerGrades.length > 0 && (
              <div className="mt-3">
                <span
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: BSL.muted }}
                >
                  Grade ·{" "}
                  <span className="font-mono" style={{ color: BSL.gold }}>
                    {playerForm.grade || "ungraded"}
                  </span>
                </span>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {playerGrades.map((g) => {
                    const on = playerForm.grade === g.code;
                    return (
                      <button
                        key={g.code}
                        type="button"
                        onClick={() =>
                          setPlayerForm((f) => ({
                            ...f,
                            grade: on ? "" : g.code,
                          }))
                        }
                        className="text-[11px] font-black px-2 py-1 rounded-md font-mono transition"
                        style={{
                          background: on ? `${BSL.gold}33` : BSL.cardSoft,
                          color: on ? BSL.gold : BSL.muted,
                          border: `1px solid ${on ? BSL.gold : BSL.border}`,
                        }}
                        data-testid={`toggle-edit-player-grade-${g.code}`}
                        title={g.label || g.code}
                      >
                        {g.code}
                      </button>
                    );
                  })}
                  {playerForm.grade && (
                    <button
                      type="button"
                      onClick={() =>
                        setPlayerForm((f) => ({ ...f, grade: "" }))
                      }
                      className="text-[10px] px-2 py-1 rounded-md"
                      style={{
                        background: BSL.cardSoft,
                        color: BSL.muted,
                        border: `1px solid ${BSL.border}`,
                      }}
                      data-testid="button-edit-player-grade-clear"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mt-3">
              <span
                className="text-[10px] uppercase tracking-widest"
                style={{ color: BSL.muted }}
              >
                Bio
              </span>
              <textarea
                value={playerForm.bio}
                onChange={(e) =>
                  setPlayerForm({ ...playerForm, bio: e.target.value })
                }
                rows={3}
                maxLength={600}
                className="w-full px-3 py-2 rounded-lg text-sm mt-1"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                  color: "white",
                }}
                data-testid="input-edit-player-bio"
              />
            </div>

            <div className="mt-4 flex gap-2 justify-end">
              <ActionButton
                variant="ghost"
                onClick={() => setEditingPlayer(null)}
                icon={<X className="h-3 w-3" />}
                testid="button-cancel-edit-player"
              >
                Cancel
              </ActionButton>
              <ActionButton
                variant="gold"
                onClick={() => savePlayer.mutate()}
                disabled={savePlayer.isPending}
                icon={<Save className="h-3 w-3" />}
                testid="button-save-edit-player"
              >
                {savePlayer.isPending ? "Saving…" : "Save"}
              </ActionButton>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AdminLayout>
  );
}
