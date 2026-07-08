import { useMemo, useState } from "react";
import { Link } from "@/lib/routing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Crown,
  Pencil,
  Save,
  AlertTriangle,
  UserCheck,
  UserX,
  Users,
  Plus,
  Shield,
  X,
  Check,
  Trophy,
  BarChart3,
  PoundSterling,
  Gauge,
  Share2,
  Layers,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BslSubNav } from "@/components/BslSubNav";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { ShareInviteDialog } from "@/components/bsl/ShareInviteDialog";
import { MatchPairsManager } from "@/components/bsl/MatchPairsManager";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ClubData = {
  club: any | null;
  teams: Array<any & { members: number[] }>;
  pending: any[];
  confirmed: any[];
  summary?: {
    roster: number;
    pending: number;
    matchesPlayed: number;
    matchesWon: number;
    moneyIn: number;
    pairs: number;
  };
  league?: {
    divisions: string[];
    divisionJoinFeePence: number;
    playerGrades?: Array<{ code: string; label?: string }>;
  } | null;
};

export default function ClubManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery<ClubData>({
    queryKey: ["/api/bsl/my-club"],
  });

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<{
    name: string;
    logoUrl: string;
    division: string;
    adminNotes: string;
  }>({
    name: "",
    logoUrl: "",
    division: "",
    adminNotes: "",
  });
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<any | null>(null);
  const [playerForm, setPlayerForm] = useState<{
    displayName: string;
    bio: string;
    division: string;
    categories: string[];
    grade: string;
  }>({ displayName: "", bio: "", division: "", categories: [], grade: "" });

  const club = data?.club;
  const pending = data?.pending || [];
  const confirmed = data?.confirmed || [];
  const summary = data?.summary;

  // List of divisions this club has joined: primary + the paid-for extras.
  // The first entry is always the primary; the rest sort A→Z for stability.
  const joinedDivisions = useMemo(() => {
    if (!club) return [] as string[];
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

  // Divisions the league offers but this club has NOT joined yet — these
  // populate the "Join another division" picker. Empty when the league only
  // has one division or the club is in all of them.
  const availableDivisions = useMemo(() => {
    const all: string[] = data?.league?.divisions || [];
    return all.filter((d) => !joinedDivisions.includes(d));
  }, [data?.league?.divisions, joinedDivisions]);

  const joinFeePence = data?.league?.divisionJoinFeePence ?? 2500;

  const startEdit = () => {
    if (!club) return;
    setForm({
      name: club.name || "",
      logoUrl: club.logoUrl || "",
      division: club.division || "",
      adminNotes: club.adminNotes || "",
    });
    setEditing(true);
  };

  const onErr = (action: string) => (e: any) =>
    toast({
      title: action,
      description: (e?.message || "Error").replace(/^\d{3}:\s*/, ""),
      variant: "destructive",
    });
  const inv = () => qc.invalidateQueries({ queryKey: ["/api/bsl/my-club"] });

  const saveDetails = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("PATCH", `/api/bsl/clubs/${club.id}/manage`, form)
      ).json(),
    onSuccess: () => {
      inv();
      setEditing(false);
      toast({ title: "Club details saved" });
    },
    onError: onErr("Failed to save"),
  });

  const withdraw = useMutation({
    mutationFn: async (reason: string) =>
      (
        await apiRequest("POST", `/api/bsl/clubs/${club.id}/withdraw`, {
          reason,
        })
      ).json(),
    onSuccess: () => {
      inv();
      setConfirmWithdraw(false);
      toast({
        title: "Club withdrawn",
        description: "An admin must reinstate before you can play again.",
      });
    },
    onError: onErr("Failed to withdraw"),
  });

  const confirmPlayer = useMutation({
    mutationFn: async (playerId: number) =>
      (
        await apiRequest(
          "POST",
          `/api/bsl/clubs/${club.id}/players/${playerId}/confirm`,
          {},
        )
      ).json(),
    onSuccess: () => {
      inv();
      toast({ title: "Player confirmed" });
    },
    onError: onErr("Couldn't confirm"),
  });

  const removePlayer = useMutation({
    mutationFn: async (playerId: number) =>
      (
        await apiRequest(
          "DELETE",
          `/api/bsl/clubs/${club.id}/players/${playerId}`,
        )
      ).json(),
    onSuccess: () => {
      inv();
      toast({ title: "Player removed" });
    },
    onError: onErr("Couldn't remove"),
  });

  const updatePlayer = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "PATCH",
          `/api/bsl/clubs/${club.id}/players/${editingPlayer.id}`,
          playerForm,
        )
      ).json(),
    onSuccess: () => {
      inv();
      setEditingPlayer(null);
      toast({ title: "Player updated" });
    },
    onError: onErr("Couldn't update player"),
  });

  const [joinDivisionPick, setJoinDivisionPick] = useState<string>("");
  const joinDivision = useMutation({
    mutationFn: async (division: string) =>
      (
        await apiRequest("POST", `/api/bsl/clubs/${club.id}/join-division`, {
          division,
        })
      ).json(),
    onSuccess: (resp: any) => {
      inv();
      setJoinDivisionPick("");
      const fee = Number(resp?.feePence ?? 0);
      toast({
        title: `Joined ${resp?.club?.additionalDivisions?.slice(-1)[0] || "division"}`,
        description:
          fee > 0
            ? `£${(fee / 100).toFixed(2)} deducted from your wallet.`
            : "No charge — additional divisions are currently free.",
      });
    },
    onError: onErr("Couldn't join division"),
  });

  if (isLoading) {
    return (
      <div
        className="min-h-screen text-white"
        style={{ background: BSL.bgDeep }}
      >
        <BSLBackground />
        <div
          className="max-w-6xl mx-auto px-4 py-12 text-center"
          style={{ color: BSL.muted }}
        >
          Loading…
        </div>
      </div>
    );
  }

  if (!club) {
    return (
      <div
        className="min-h-screen text-white"
        style={{ background: BSL.bgDeep }}
      >
        <BSLBackground />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <BackBar />
          <GlowPanel
            title="No BSL club yet"
            tone="gold"
            icon={<Crown className="h-4 w-4" />}
          >
            <p className="text-sm mb-4" style={{ color: BSL.muted }}>
              You haven't registered a club for the Birmingham Super League.
            </p>
            <Link href="/register-club">
              <ActionButton variant="gold" icon={<Plus className="h-3 w-3" />}>
                Register your club
              </ActionButton>
            </Link>
          </GlowPanel>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <BackBar />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-end justify-between gap-3"
          data-testid="header-club-manager"
        >
          <div>
            <div
              className="text-xs uppercase tracking-widest"
              style={{ color: BSL.cyan }}
            >
              Club Owner Control
            </div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
              {club.name} <span style={{ color: BSL.gold }}>· Manage</span>
            </h1>
            <p className="text-sm mt-1" style={{ color: BSL.muted }}>
              Status:{" "}
              <span
                style={{ color: club.withdrawnAt ? BSL.danger : BSL.success }}
                data-testid="text-club-status"
              >
                {club.withdrawnAt ? "WITHDRAWN" : club.status}
              </span>
              {" · "}Division: {club.division}
              {" · "}Invite code:{" "}
              <span style={{ color: BSL.gold }} data-testid="text-invite-code">
                {club.inviteCode || "—"}
              </span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {club.inviteCode && club.status === "ACTIVE" && (
              <ActionButton
                variant="gold"
                icon={<Share2 className="h-3 w-3" />}
                onClick={() => setShareOpen(true)}
                data-testid="button-share-club"
              >
                Share invite
              </ActionButton>
            )}
            {!editing && (
              <ActionButton
                variant="cyan"
                icon={<Pencil className="h-3 w-3" />}
                onClick={startEdit}
                data-testid="button-edit-club"
              >
                Edit details
              </ActionButton>
            )}
            {!club.withdrawnAt && (
              <ActionButton
                variant="ghost"
                icon={<AlertTriangle className="h-3 w-3" />}
                onClick={() => setConfirmWithdraw(true)}
                data-testid="button-withdraw-club"
              >
                Withdraw club
              </ActionButton>
            )}
          </div>
        </motion.div>

        {club.inviteCode && (
          <ShareInviteDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            title={`Share · ${club.name}`}
            subtitle="Send this to your players. Anyone with the link or QR can sign up and join your club in the BSL."
            shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/bsl/join?code=${club.inviteCode}`}
            inviteCode={club.inviteCode}
            filenameSlug={`bsl-${club.name}`}
          />
        )}

        {/* DASHBOARD STAT TILES */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            <DashTile
              icon={<Users className="h-4 w-4" />}
              label="Roster"
              value={summary.roster}
              sub={`${summary.pending} pending`}
              tone="gold"
              testid="tile-roster"
            />
            <DashTile
              icon={<Shield className="h-4 w-4" />}
              label="Pairs"
              value={summary.pairs}
              sub="across MD/WD/XD"
              tone="cyan"
              testid="tile-pairs"
            />
            <DashTile
              icon={<Trophy className="h-4 w-4" />}
              label="Wins"
              value={summary.matchesWon}
              sub={`of ${summary.matchesPlayed}`}
              tone="gold"
              testid="tile-wins"
            />
            <DashTile
              icon={<Gauge className="h-4 w-4" />}
              label="Win %"
              value={
                summary.matchesPlayed > 0
                  ? `${Math.round((summary.matchesWon / summary.matchesPlayed) * 100)}%`
                  : "—"
              }
              sub="club average"
              tone="cyan"
              testid="tile-winrate"
            />
            <DashTile
              icon={<BarChart3 className="h-4 w-4" />}
              label="Matches"
              value={summary.matchesPlayed}
              sub="all categories"
              tone="cyan"
              testid="tile-matches"
            />
            <DashTile
              icon={<PoundSterling className="h-4 w-4" />}
              label="Money in"
              value={`£${(summary.moneyIn / 100).toFixed(0)}`}
              sub="from members"
              tone="gold"
              testid="tile-money-in"
            />
          </div>
        )}

        {/* Edit form */}
        <AnimatePresence>
          {editing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
            >
              <GlowPanel
                title="Edit club details"
                tone="cyan"
                icon={<Pencil className="h-4 w-4" />}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Club name">
                    <TextInput
                      value={form.name}
                      onChange={(v) => setForm({ ...form, name: v })}
                      testid="input-club-name"
                    />
                  </Field>
                  <Field label="Division">
                    <TextInput
                      value={form.division}
                      onChange={(v) => setForm({ ...form, division: v })}
                      testid="input-club-division"
                    />
                  </Field>
                  <Field label="Logo URL">
                    <TextInput
                      value={form.logoUrl}
                      onChange={(v) => setForm({ ...form, logoUrl: v })}
                      testid="input-club-logo"
                    />
                  </Field>
                  <Field label="Notes (visible to admin)">
                    <TextInput
                      value={form.adminNotes}
                      onChange={(v) => setForm({ ...form, adminNotes: v })}
                      testid="input-club-notes"
                    />
                  </Field>
                </div>
                <div className="mt-4 flex gap-2 justify-end">
                  <ActionButton
                    variant="ghost"
                    onClick={() => setEditing(false)}
                    icon={<X className="h-3 w-3" />}
                    data-testid="button-cancel-edit"
                  >
                    Cancel
                  </ActionButton>
                  <ActionButton
                    variant="gold"
                    onClick={() => saveDetails.mutate()}
                    disabled={saveDetails.isPending}
                    icon={<Save className="h-3 w-3" />}
                    data-testid="button-save-edit"
                  >
                    {saveDetails.isPending ? "Saving…" : "Save"}
                  </ActionButton>
                </div>
              </GlowPanel>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pending requests */}
        {pending.length > 0 && (
          <GlowPanel
            title={`Pending join requests (${pending.length})`}
            tone="cyan"
            icon={<UserCheck className="h-4 w-4" />}
            collapsible
            defaultOpen
          >
            <ul className="space-y-2">
              {pending.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-lg px-3 py-2"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                  }}
                  data-testid={`row-pending-player-${p.id}`}
                >
                  <div>
                    <div className="font-semibold text-sm">
                      {p.displayName || p.user?.name || "Player"}
                    </div>
                    <div className="text-xs" style={{ color: BSL.muted }}>
                      {p.user?.email}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <ActionButton
                      variant="gold"
                      onClick={() => confirmPlayer.mutate(p.id)}
                      disabled={confirmPlayer.isPending}
                      icon={<Check className="h-3 w-3" />}
                      data-testid={`button-confirm-${p.id}`}
                    >
                      Confirm
                    </ActionButton>
                    <ActionButton
                      variant="ghost"
                      onClick={() => removePlayer.mutate(p.id)}
                      disabled={removePlayer.isPending}
                      icon={<X className="h-3 w-3" />}
                      data-testid={`button-reject-${p.id}`}
                    >
                      Decline
                    </ActionButton>
                  </div>
                </li>
              ))}
            </ul>
          </GlowPanel>
        )}

        {/* Confirmed roster — one table per joined division so multi-division
            clubs can see who's signed up to what. Players with NULL division
            fall back to the club's primary division. */}
        {(joinedDivisions.length > 0 ? joinedDivisions : [club.division]).map(
          (div) => {
            const divMembers = confirmed.filter(
              (p) => (p.division || club.division) === div,
            );
            return (
              <GlowPanel
                key={`members-${div}`}
                title={`${div} — Members (${divMembers.length})`}
                subtitle="Stats, payments & profile"
                tone="gold"
                icon={<Shield className="h-4 w-4" />}
                collapsible
                defaultOpen
              >
                {divMembers.length === 0 ? (
                  <Empty text={`No confirmed players in ${div} yet.`} />
                ) : (
                  <div className="overflow-x-auto -mx-2">
                    <table className="w-full text-sm" style={{ minWidth: 720 }}>
                      <thead>
                        <tr
                          className="text-[10px] uppercase tracking-widest"
                          style={{ color: BSL.muted }}
                        >
                          <th className="text-left px-3 py-2">Player</th>
                          <th className="text-left px-3 py-2">Categories</th>
                          <th className="text-left px-3 py-2">Status</th>
                          <th className="text-right px-3 py-2">P / W / L</th>
                          <th className="text-right px-3 py-2">Win %</th>
                          <th className="text-right px-3 py-2">Paid</th>
                          <th className="text-right px-3 py-2">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {divMembers.map((p) => {
                          const played = p.matchesPlayed || 0;
                          const won = p.matchesWon || 0;
                          const lost = Math.max(0, played - won);
                          const winPct =
                            played > 0
                              ? Math.round((won / played) * 100)
                              : null;
                          const statusTone =
                            p.status === "ACTIVE"
                              ? BSL.success
                              : p.status === "PENDING_PAYMENT"
                                ? BSL.gold
                                : BSL.muted;
                          return (
                            <tr
                              key={p.id}
                              className="border-t"
                              style={{ borderColor: BSL.border }}
                              data-testid={`row-member-${p.id}`}
                            >
                              <td className="px-3 py-2.5">
                                <div className="font-semibold">
                                  {p.displayName || p.user?.name || "Player"}
                                </div>
                                <div
                                  className="text-[11px]"
                                  style={{ color: BSL.muted }}
                                >
                                  {p.user?.email}
                                </div>
                              </td>
                              <td className="px-3 py-2.5">
                                <div className="flex flex-wrap gap-1">
                                  {(p.categories || []).length === 0 ? (
                                    <span
                                      className="text-[11px]"
                                      style={{ color: BSL.muted }}
                                    >
                                      —
                                    </span>
                                  ) : (
                                    (p.categories || []).map((c: string) => (
                                      <span
                                        key={c}
                                        className="px-1.5 py-0.5 rounded text-[10px] font-bold"
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
                              <td className="px-3 py-2.5">
                                <span
                                  className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest"
                                  style={{
                                    background: `${statusTone}22`,
                                    color: statusTone,
                                  }}
                                  data-testid={`text-status-${p.id}`}
                                >
                                  {p.status}
                                </span>
                              </td>
                              <td
                                className="px-3 py-2.5 text-right tabular-nums"
                                style={{ color: BSL.muted }}
                              >
                                <span style={{ color: BSL.text }}>
                                  {played}
                                </span>
                                <span> · </span>
                                <span style={{ color: BSL.success }}>
                                  {won}
                                </span>
                                <span> · </span>
                                <span style={{ color: BSL.danger }}>
                                  {lost}
                                </span>
                              </td>
                              <td
                                className="px-3 py-2.5 text-right font-bold tabular-nums"
                                style={{
                                  color: winPct == null ? BSL.muted : BSL.gold,
                                }}
                              >
                                {winPct == null ? "—" : `${winPct}%`}
                              </td>
                              <td
                                className="px-3 py-2.5 text-right font-bold tabular-nums"
                                style={{ color: BSL.gold }}
                                data-testid={`text-paid-${p.id}`}
                              >
                                £{((p.paidTotal || 0) / 100).toFixed(2)}
                              </td>
                              <td className="px-3 py-2.5 text-right">
                                <div className="inline-flex gap-1">
                                  <button
                                    onClick={() => {
                                      setEditingPlayer(p);
                                      setPlayerForm({
                                        displayName: p.displayName || "",
                                        bio: p.bio || "",
                                        division:
                                          p.division || club.division || "",
                                        categories: Array.isArray(p.categories)
                                          ? [...p.categories]
                                          : [],
                                        grade: p.grade || "",
                                      });
                                    }}
                                    className="p-1.5 rounded-md"
                                    style={{
                                      background: `${BSL.cyan}22`,
                                      color: BSL.cyan,
                                    }}
                                    data-testid={`button-edit-player-${p.id}`}
                                    title="Edit player"
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Remove ${p.displayName || p.user?.name || "player"} from the club?`,
                                        )
                                      )
                                        removePlayer.mutate(p.id);
                                    }}
                                    className="p-1.5 rounded-md"
                                    style={{
                                      background: `${BSL.danger}22`,
                                      color: BSL.danger,
                                    }}
                                    data-testid={`button-remove-player-${p.id}`}
                                    title="Remove from club"
                                  >
                                    <UserX className="h-3 w-3" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </GlowPanel>
            );
          },
        )}

        {/* Divisions — primary + paid-for extras, with a Join Another tile. */}
        <GlowPanel
          title="Divisions"
          subtitle={`Your club competes in ${joinedDivisions.length} division${joinedDivisions.length === 1 ? "" : "s"}.`}
          tone="cyan"
          icon={<Layers className="h-4 w-4" />}
          collapsible
          defaultOpen
        >
          <div className="flex flex-wrap items-center gap-2">
            {joinedDivisions.map((d, i) => (
              <span
                key={d}
                className="px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5"
                style={{
                  background: i === 0 ? `${BSL.gold}1f` : `${BSL.cyan}1a`,
                  color: i === 0 ? BSL.gold : BSL.cyan,
                  border: `1px solid ${i === 0 ? BSL.gold : BSL.cyan}55`,
                }}
                data-testid={`badge-joined-division-${d}`}
              >
                {i === 0 && <Crown className="h-3 w-3" />}
                {d}
                {i === 0 && (
                  <span className="text-[9px] opacity-80 uppercase tracking-widest">
                    Primary
                  </span>
                )}
              </span>
            ))}
            {availableDivisions.length > 0 ? (
              <div className="flex items-center gap-2 ml-auto">
                <select
                  value={joinDivisionPick}
                  onChange={(e) => setJoinDivisionPick(e.target.value)}
                  className="text-xs rounded-lg px-2.5 py-1.5"
                  style={{
                    background: BSL.cardSoft,
                    color: "white",
                    border: `1px solid ${BSL.border}`,
                  }}
                  data-testid="select-join-division"
                >
                  <option value="">Join another division…</option>
                  {availableDivisions.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ActionButton
                  variant="gold"
                  disabled={!joinDivisionPick || joinDivision.isPending}
                  onClick={() => {
                    if (!joinDivisionPick) return;
                    const fee = (joinFeePence / 100).toFixed(2);
                    const msg =
                      joinFeePence > 0
                        ? `Join "${joinDivisionPick}" for £${fee}? This will be deducted from your BSL wallet.`
                        : `Join "${joinDivisionPick}"? Additional divisions are currently free.`;
                    if (confirm(msg)) joinDivision.mutate(joinDivisionPick);
                  }}
                  icon={<Plus className="h-3 w-3" />}
                  data-testid="button-confirm-join-division"
                >
                  {joinDivision.isPending
                    ? "Joining…"
                    : joinFeePence > 0
                      ? `Join (£${(joinFeePence / 100).toFixed(2)})`
                      : "Join (free)"}
                </ActionButton>
              </div>
            ) : (
              <span
                className="ml-auto text-[10px]"
                style={{ color: BSL.muted }}
              >
                You're in every available division.
              </span>
            )}
          </div>
          <div className="mt-2 text-[10px]" style={{ color: BSL.muted }}>
            Pairs are now built per match in the Match Pairs section below. The
            same player can be paired in the same category across multiple
            matches.
          </div>
        </GlowPanel>
      </div>

      {/* Match-specific pairs — pick a match and build its pairs */}
      <div className="mt-4">
        <MatchPairsManager
          clubId={club.id}
          roster={confirmed}
          primaryDivision={club.division}
        />
      </div>

      {/* Player edit modal */}
      <AnimatePresence>
        {editingPlayer && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setEditingPlayer(null)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl p-6"
              style={{
                background: BSL.card,
                border: `1px solid ${BSL.cyan}55`,
              }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              data-testid="modal-edit-player"
            >
              <div className="flex items-center gap-3 mb-4">
                <Pencil className="h-5 w-5" style={{ color: BSL.cyan }} />
                <h3 className="text-lg font-bold">
                  Edit {editingPlayer.user?.name || "player"}
                </h3>
              </div>
              <Field label="Display name (shown on leaderboard)">
                <TextInput
                  value={playerForm.displayName}
                  onChange={(v) =>
                    setPlayerForm({ ...playerForm, displayName: v })
                  }
                  testid="input-edit-player-display"
                />
              </Field>
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
                    Player must not be in a pair to switch divisions — remove
                    them from pairs first.
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
                  Removing a category they're paired in will also strip them
                  from those pairs.
                </p>
              </div>
              {Array.isArray(data?.league?.playerGrades) &&
                data!.league!.playerGrades.length > 0 && (
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
                      {data!.league!.playerGrades.map((g: any) => {
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
                  data-testid="button-cancel-edit-player"
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  variant="gold"
                  onClick={() => updatePlayer.mutate()}
                  disabled={updatePlayer.isPending}
                  icon={<Save className="h-3 w-3" />}
                  data-testid="button-save-edit-player"
                >
                  {updatePlayer.isPending ? "Saving…" : "Save"}
                </ActionButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Withdraw confirmation */}
      <AnimatePresence>
        {confirmWithdraw && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ background: "rgba(0,0,0,0.7)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmWithdraw(false)}
          >
            <motion.div
              className="w-full max-w-md rounded-2xl p-6"
              style={{
                background: BSL.card,
                border: `1px solid ${BSL.gold}55`,
              }}
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              data-testid="modal-withdraw"
            >
              <div className="flex items-center gap-3 mb-4">
                <AlertTriangle
                  className="h-6 w-6"
                  style={{ color: BSL.danger }}
                />
                <h3 className="text-xl font-bold">Withdraw {club.name}?</h3>
              </div>
              <p className="text-sm mb-4" style={{ color: BSL.muted }}>
                Your club will be removed from upcoming fixtures and standings.
                An admin must reinstate it before you can compete again. This
                does not refund any fees.
              </p>
              <div className="flex gap-2 justify-end">
                <ActionButton
                  variant="ghost"
                  onClick={() => setConfirmWithdraw(false)}
                  data-testid="button-cancel-withdraw"
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  variant="gold"
                  onClick={() =>
                    withdraw.mutate(
                      prompt("Reason for withdrawal? (optional)") || "",
                    )
                  }
                  disabled={withdraw.isPending}
                  data-testid="button-confirm-withdraw"
                >
                  {withdraw.isPending ? "Withdrawing…" : "Yes, withdraw"}
                </ActionButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DashTile({
  icon,
  label,
  value,
  sub,
  tone,
  testid,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  tone: "gold" | "cyan";
  testid?: string;
}) {
  const c = tone === "gold" ? BSL.gold : BSL.cyan;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl p-3"
      style={{ background: BSL.card, border: `1px solid ${c}33` }}
      data-testid={testid}
    >
      <div
        className="flex items-center justify-between text-[10px] uppercase tracking-widest"
        style={{ color: BSL.muted }}
      >
        <span>{label}</span>
        <span style={{ color: c }}>{icon}</span>
      </div>
      <div
        className="text-2xl font-black mt-1 tabular-nums"
        style={{ color: c }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px]" style={{ color: BSL.muted }}>
          {sub}
        </div>
      )}
    </motion.div>
  );
}

function BackBar() {
  return (
    <Link href="/">
      <a
        className="inline-flex items-center gap-1.5 text-xs hover:opacity-80"
        style={{ color: BSL.muted }}
        data-testid="link-back-bsl"
      >
        <ArrowLeft className="h-3 w-3" /> Back to BSL hub
      </a>
    </Link>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span
        className="text-[10px] uppercase tracking-widest"
        style={{ color: BSL.muted }}
      >
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function TextInput({
  value,
  onChange,
  testid,
}: {
  value: string;
  onChange: (v: string) => void;
  testid?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg text-sm"
      style={{
        background: BSL.cardSoft,
        border: `1px solid ${BSL.border}`,
        color: "white",
      }}
      data-testid={testid}
    />
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="text-xs py-3 text-center" style={{ color: BSL.muted }}>
      {text}
    </div>
  );
}
