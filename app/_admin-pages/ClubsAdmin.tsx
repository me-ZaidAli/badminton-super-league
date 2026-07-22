import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  Search,
  Flag,
  ShieldOff,
  ShieldCheck,
  ExternalLink,
  X,
  Save,
  Copy,
  Check,
  BadgeCheck,
  CircleDollarSign,
  Share2,
  Plus,
  Layers,
  Moon,
  Sun,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import { Link } from "@/lib/routing";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { ShareInviteDialog } from "@/components/bsl/ShareInviteDialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const STATUS_COLOR: any = {
  PENDING_PAYMENT: BSL.muted,
  PENDING_VERIFICATION: BSL.gold,
  ACTIVE: BSL.success,
  REJECTED: BSL.danger,
};

export default function ClubsAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [divFilter, setDivFilter] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [copied, setCopied] = useState<number | null>(null);
  const [shareClub, setShareClub] = useState<any | null>(null);
  const [creating, setCreating] = useState(false);
  const create = useMutation({
    mutationFn: async (v: any) =>
      (await apiRequest("POST", "/api/bsl/admin/clubs", v)).json(),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
      setCreating(false);
      toast({
        title: "Club created",
        description: d.inviteCode
          ? `Invite: ${d.inviteCode}`
          : "Saved as pending payment",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const { data: clubs } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/clubs", statusFilter, divFilter, q],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (divFilter) params.set("division", divFilter);
      if (q) params.set("q", q);
      const r = await fetch(`/api/bsl/admin/clubs?${params.toString()}`, {
        credentials: "include",
      });
      return r.json();
    },
  });

  const editing = useMemo(
    () => (clubs || []).find((c: any) => c.id === editId),
    [clubs, editId],
  );
  const update = useMutation({
    mutationFn: async (v: { id: number; data: any }) =>
      (
        await apiRequest("PATCH", `/api/bsl/admin/clubs/${v.id}`, v.data)
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] });
      toast({ title: "Saved" });
    },
  });
  const approve = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/bsl/clubs/${id}/approve`, {})).json(),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/audit"] });
      toast({ title: "Approved", description: `Invite: ${d.inviteCode}` });
    },
  });
  // Mark-paid / mark-pending — flips the club's registration payment status.
  // Marking pending hides the club from the public `/api/bsl/clubs` list.
  const setPaymentStatus = useMutation({
    mutationFn: async (v: {
      id: number;
      status: "ACTIVE" | "PENDING_PAYMENT";
    }) =>
      (
        await apiRequest(
          "PATCH",
          `/api/bsl/admin/clubs/${v.id}/payment-status`,
          { status: v.status },
        )
      ).json(),
    onSuccess: (d: any, v) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/audit"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
      toast({
        title:
          v.status === "ACTIVE" ? "Marked as paid" : "Marked pending payment",
        description:
          v.status === "ACTIVE"
            ? `Invite: ${d.inviteCode}`
            : "Club hidden from public list",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  // Super-admin sleep / wake — keeps all club data; just flips a flag.
  const setSleep = useMutation({
    mutationFn: async (v: { id: number; sleeping: boolean }) =>
      (
        await apiRequest("PATCH", `/api/bsl/admin/clubs/${v.id}/sleep`, {
          sleeping: v.sleeping,
        })
      ).json(),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/dashboard"] });
      toast({
        title: v.sleeping ? "Club put to sleep" : "Club woken up",
        description: v.sleeping
          ? "Data preserved. Public list shows a Sleeping badge."
          : "Club is active again.",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  // Super-admin wipe out — hard delete; requires typing the club name.
  const [wipeTarget, setWipeTarget] = useState<any | null>(null);
  const [wipeConfirm, setWipeConfirm] = useState("");
  const wipeOut = useMutation({
    mutationFn: async (v: { id: number; confirmName: string }) =>
      (
        await apiRequest("DELETE", `/api/bsl/admin/clubs/${v.id}/wipe`, {
          confirmName: v.confirmName,
        })
      ).json(),
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/dashboard"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/audit"] });
      setWipeTarget(null);
      setWipeConfirm("");
      toast({
        title: "Club wiped out",
        description: `Deleted ${d.fixtures || 0} fixtures. Player accounts preserved.`,
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  return (
    <AdminLayout active="clubs">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            Clubs <span style={{ color: BSL.gold }}>Registry</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: BSL.muted }}>
            Create · approve · suspend · flag · assign divisions · invite codes
            · manage pairs
          </p>
        </div>
        <ActionButton
          variant="gold"
          icon={<Plus className="h-3 w-3" />}
          onClick={() => setCreating(true)}
          testid="button-create-club"
        >
          New club
        </ActionButton>
      </div>

      <GlowPanel
        title={`${clubs?.length ?? 0} clubs`}
        tone="gold"
        icon={<Building2 className="h-4 w-4" />}
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
              placeholder="Search by name or reference…"
              className="w-full pl-8 pr-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-club-search"
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
            data-testid="select-status-filter"
          >
            <option value="">All statuses</option>
            <option value="PENDING_PAYMENT">Pending payment</option>
            <option value="PENDING_VERIFICATION">Pending verification</option>
            <option value="ACTIVE">Active</option>
            <option value="REJECTED">Rejected</option>
          </select>
          <select
            value={divFilter}
            onChange={(e) => setDivFilter(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="select-division-filter"
          >
            <option value="">All divisions</option>
            {(league?.divisions || []).map((d: string) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        {!clubs?.length ? (
          <div
            className="py-10 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            No clubs match those filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-[10px] uppercase tracking-widest"
                  style={{ color: BSL.muted }}
                >
                  <th className="text-left px-2 py-2">Club</th>
                  <th className="text-left px-2 py-2">Division</th>
                  <th className="text-left px-2 py-2">Teams</th>
                  <th className="text-left px-2 py-2">Status</th>
                  <th className="text-left px-2 py-2">Invite</th>
                  <th className="text-left px-2 py-2">Flags</th>
                  <th className="text-right px-2 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {clubs.map((c: any, i: number) => (
                  <motion.tr
                    key={c.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-t"
                    style={{ borderColor: BSL.border }}
                    data-testid={`row-club-${c.id}`}
                  >
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-8 w-8 rounded-md flex items-center justify-center text-xs font-black overflow-hidden"
                          style={{
                            background: `${BSL.gold}22`,
                            color: BSL.gold,
                          }}
                        >
                          {c.logoUrl ? (
                            <img
                              src={c.logoUrl}
                              className="h-full w-full object-cover"
                              alt=""
                            />
                          ) : (
                            c.name.slice(0, 2)
                          )}
                        </div>
                        <div>
                          <div className="font-bold">{c.name}</div>
                          <div
                            className="text-[10px]"
                            style={{ color: BSL.faint }}
                          >
                            {c.paymentReference}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <span>{c.division}</span>
                        {Array.isArray(c.additionalDivisions) &&
                          c.additionalDivisions.map((d: string) => (
                            <span
                              key={d}
                              className="text-[9px] uppercase font-black px-1.5 py-0.5 rounded"
                              style={{
                                background: `${BSL.cyan}1f`,
                                color: BSL.cyan,
                                border: `1px solid ${BSL.cyan}55`,
                              }}
                              data-testid={`badge-extra-div-${c.id}-${d}`}
                            >
                              +{d}
                            </span>
                          ))}
                      </div>
                    </td>
                    <td className="px-2 py-3 tabular-nums">{c.teamCount}</td>
                    <td className="px-2 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <span
                          className="text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded"
                          style={{
                            background: `${STATUS_COLOR[c.status]}22`,
                            color: STATUS_COLOR[c.status],
                          }}
                        >
                          {c.status.replace("_", " ")}
                        </span>
                        {c.sleepingAt && (
                          <span
                            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-black px-2 py-0.5 rounded"
                            style={{
                              background: "hsla(220,40%,60%,0.18)",
                              color: "hsl(220,80%,75%)",
                            }}
                            data-testid={`badge-sleeping-${c.id}`}
                          >
                            <Moon className="h-3 w-3" /> Sleeping
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3">
                      {c.inviteCode ? (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(c.inviteCode);
                            setCopied(c.id);
                            setTimeout(() => setCopied(null), 1500);
                          }}
                          className="inline-flex items-center gap-1.5 text-xs font-mono px-2 py-1 rounded"
                          style={{
                            background: `${BSL.cyan}22`,
                            color: BSL.cyan,
                          }}
                          data-testid={`button-copy-invite-${c.id}`}
                        >
                          {copied === c.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                          {c.inviteCode}
                        </button>
                      ) : (
                        <span style={{ color: BSL.faint }}>—</span>
                      )}
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex gap-1">
                        {c.isFlagged && (
                          <Flag
                            className="h-3 w-3"
                            style={{ color: BSL.gold }}
                          />
                        )}
                        {c.isSuspended && (
                          <ShieldOff
                            className="h-3 w-3"
                            style={{ color: BSL.danger }}
                          />
                        )}
                      </div>
                    </td>
                    <td className="px-2 py-3 text-right">
                      <div className="flex justify-end gap-1 flex-wrap">
                        {c.status === "PENDING_VERIFICATION" && (
                          <ActionButton
                            variant="cyan"
                            onClick={() => approve.mutate(c.id)}
                          >
                            Approve
                          </ActionButton>
                        )}
                        {c.status !== "ACTIVE" && c.status !== "REJECTED" && (
                          <ActionButton
                            variant="cyan"
                            icon={<BadgeCheck className="h-3 w-3" />}
                            onClick={() =>
                              setPaymentStatus.mutate({
                                id: c.id,
                                status: "ACTIVE",
                              })
                            }
                            disabled={setPaymentStatus.isPending}
                            testid={`button-mark-paid-${c.id}`}
                          >
                            Mark paid
                          </ActionButton>
                        )}
                        {c.status === "ACTIVE" && (
                          <ActionButton
                            variant="ghost"
                            icon={<CircleDollarSign className="h-3 w-3" />}
                            onClick={() => {
                              if (
                                confirm(
                                  `Mark "${c.name}" as PENDING PAYMENT?\n\nThis will hide the club from the public list until payment is reconfirmed.`,
                                )
                              ) {
                                setPaymentStatus.mutate({
                                  id: c.id,
                                  status: "PENDING_PAYMENT",
                                });
                              }
                            }}
                            disabled={setPaymentStatus.isPending}
                            testid={`button-mark-pending-${c.id}`}
                          >
                            Mark unpaid
                          </ActionButton>
                        )}
                        {c.inviteCode && (
                          <ActionButton
                            variant="ghost"
                            icon={<Share2 className="h-3 w-3" />}
                            onClick={() => setShareClub(c)}
                            testid={`button-share-club-${c.id}`}
                          >
                            Share
                          </ActionButton>
                        )}
                        <Link href={`/admin/clubs/${c.id}/manage`}>
                          <ActionButton
                            variant="cyan"
                            icon={<Layers className="h-3 w-3" />}
                            testid={`button-manage-club-${c.id}`}
                          >
                            Manage
                          </ActionButton>
                        </Link>
                        <ActionButton
                          variant="gold"
                          onClick={() => setEditId(c.id)}
                        >
                          Edit
                        </ActionButton>
                        {c.sleepingAt ? (
                          <ActionButton
                            variant="cyan"
                            icon={<Sun className="h-3 w-3" />}
                            onClick={() =>
                              setSleep.mutate({ id: c.id, sleeping: false })
                            }
                            disabled={setSleep.isPending}
                            testid={`button-wake-club-${c.id}`}
                          >
                            Wake
                          </ActionButton>
                        ) : (
                          <ActionButton
                            variant="ghost"
                            icon={<Moon className="h-3 w-3" />}
                            onClick={() => {
                              if (
                                confirm(
                                  `Put "${c.name}" to sleep?\n\nAll data is preserved (fixtures, players, results). The club will appear on public lists with a "Sleeping" badge until you wake it again.`,
                                )
                              ) {
                                setSleep.mutate({ id: c.id, sleeping: true });
                              }
                            }}
                            disabled={setSleep.isPending}
                            testid={`button-sleep-club-${c.id}`}
                          >
                            Put to sleep
                          </ActionButton>
                        )}
                        <ActionButton
                          variant="ghost"
                          icon={<Trash2 className="h-3 w-3" />}
                          onClick={() => {
                            setWipeTarget(c);
                            setWipeConfirm("");
                          }}
                          testid={`button-wipe-club-${c.id}`}
                        >
                          Wipe out
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

      {wipeTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => !wipeOut.isPending && setWipeTarget(null)}
        >
          <div
            className="max-w-md w-full rounded-xl p-5"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.danger}55`,
            }}
            onClick={(e) => e.stopPropagation()}
            data-testid="dialog-wipe-club"
          >
            <div className="flex items-start gap-3 mb-3">
              <div
                className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `${BSL.danger}22`, color: BSL.danger }}
              >
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div
                  className="text-base font-black uppercase tracking-wide"
                  style={{ color: BSL.danger }}
                >
                  Wipe out club
                </div>
                <div className="text-xs mt-1" style={{ color: BSL.muted }}>
                  This is permanent. Fixtures, rubbers, teams and wallet
                  transactions for{" "}
                  <span className="font-bold text-white">
                    {wipeTarget.name}
                  </span>{" "}
                  will be deleted forever. Player accounts are preserved but
                  will be unlinked from this club.
                </div>
              </div>
            </div>
            <label
              className="block text-[11px] uppercase tracking-widest font-bold mb-1"
              style={{ color: BSL.muted }}
            >
              Type{" "}
              <span className="font-mono text-white">{wipeTarget.name}</span> to
              confirm
            </label>
            <input
              type="text"
              value={wipeConfirm}
              onChange={(e) => setWipeConfirm(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{
                background: "rgba(0,0,0,0.4)",
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-wipe-confirm"
            />
            <div className="flex justify-end gap-2 mt-4">
              <ActionButton
                variant="ghost"
                onClick={() => setWipeTarget(null)}
                disabled={wipeOut.isPending}
                testid="button-wipe-cancel"
              >
                Cancel
              </ActionButton>
              <button
                type="button"
                disabled={wipeConfirm !== wipeTarget.name || wipeOut.isPending}
                onClick={() =>
                  wipeOut.mutate({
                    id: wipeTarget.id,
                    confirmName: wipeConfirm,
                  })
                }
                className="px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1.5"
                style={{ background: BSL.danger, color: "white" }}
                data-testid="button-wipe-confirm"
              >
                <Trash2 className="h-3 w-3" />{" "}
                {wipeOut.isPending ? "Wiping…" : "Wipe out"}
              </button>
            </div>
          </div>
        </div>
      )}

      {shareClub && (
        <ShareInviteDialog
          open={!!shareClub}
          onOpenChange={(o) => !o && setShareClub(null)}
          title={`Share · ${shareClub.name}`}
          subtitle="Anyone with this link or QR can sign up and join this club in the BSL."
          shareUrl={`${typeof window !== "undefined" ? window.location.origin : ""}/bsl/join?code=${shareClub.inviteCode}`}
          inviteCode={shareClub.inviteCode}
          filenameSlug={`bsl-${shareClub.name}`}
        />
      )}

      {creating && (
        <CreateClubDialog
          divisions={
            league?.divisions || ["Premier", "Championship", "Division 1"]
          }
          onClose={() => setCreating(false)}
          onSubmit={(data) => create.mutate(data)}
          submitting={create.isPending}
        />
      )}

      {editing && (
        <ClubEditor
          club={editing}
          divisions={league?.divisions || []}
          onClose={() => setEditId(null)}
          onSave={(data) =>
            update
              .mutateAsync({ id: editing.id, data })
              .then(() => setEditId(null))
          }
        />
      )}
    </AdminLayout>
  );
}

function ClubEditor({ club, divisions, onClose, onSave }: any) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState({
    name: club.name,
    division: club.division,
    teamCount: club.teamCount,
    logoUrl: club.logoUrl || "",
    additionalDivisions: Array.isArray(club.additionalDivisions)
      ? [...club.additionalDivisions]
      : [],
    isFlagged: club.isFlagged,
    isSuspended: club.isSuspended,
    adminNotes: club.adminNotes || "",
  });

  // Live roster + admin list. We fetch the manager-view (already used by the
  // /clubs/:id/manage page) to get the active player + user mapping in one go.
  const { data: managerView } = useQuery<any>({
    queryKey: [`/api/bsl/admin/clubs/${club.id}/manager-view`],
  });
  const roster: any[] = managerView?.roster || [];
  const adminUserIds: number[] = Array.isArray(club.adminUserIds)
    ? club.adminUserIds
    : [];

  const setAdmins = useMutation({
    mutationFn: async (userIds: number[]) =>
      (
        await apiRequest("PATCH", `/api/bsl/clubs/${club.id}/admins`, {
          userIds,
        })
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      toast({ title: "Club admins updated" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  // Reassign owner — OWNER-only on the server, but the button is visible
  // because we can't tell server-side roles from here cheaply. The 403 message
  // surfaces if a non-owner tries.
  const [ownerSearch, setOwnerSearch] = useState("");
  const { data: ownerCandidates } = useQuery<any[]>({
    queryKey: ["/api/admin/users/search-for-coach", ownerSearch],
    queryFn: async () => {
      if (ownerSearch.trim().length < 2) return [];
      const r = await fetch(
        `/api/admin/users/search-for-coach?q=${encodeURIComponent(ownerSearch)}`,
        { credentials: "include" },
      );
      return r.ok ? r.json() : [];
    },
    enabled: ownerSearch.trim().length >= 2,
  });
  const reassignOwner = useMutation({
    mutationFn: async (userId: number) =>
      (
        await apiRequest("PATCH", `/api/bsl/admin/clubs/${club.id}/owner`, {
          userId,
        })
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      setOwnerSearch("");
      toast({ title: "Owner reassigned" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
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
        className="w-full max-w-lg rounded-2xl p-6"
        style={{
          background: BSL.card,
          border: `1px solid ${BSL.gold}55`,
          boxShadow: `0 24px 64px hsla(222,80%,2%,0.6), 0 0 0 1px ${BSL.gold}22`,
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="dialog-edit-club"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black uppercase tracking-tight">
            Edit · <span style={{ color: BSL.gold }}>{club.name}</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded"
            style={{ background: BSL.cardSoft }}
            data-testid="button-close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Name">
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-name"
            />
          </Field>
          <Field label="Logo / profile picture URL (optional)">
            <div className="flex items-center gap-3">
              <div
                className="h-12 w-12 rounded-lg overflow-hidden flex items-center justify-center shrink-0"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                }}
              >
                {form.logoUrl &&
                /^(https?:\/\/|\/uploads\/|\/files\/)/i.test(form.logoUrl) ? (
                  <img
                    src={form.logoUrl}
                    className="h-full w-full object-contain"
                    alt=""
                  />
                ) : (
                  <span
                    className="text-[10px] font-black"
                    style={{ color: BSL.faint }}
                  >
                    {(form.name || "?").slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <input
                value={form.logoUrl}
                onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
                placeholder="https://…"
                className="flex-1 px-3 py-2 rounded-lg text-sm"
                style={{
                  background: BSL.cardSoft,
                  border: `1px solid ${BSL.border}`,
                  color: "white",
                }}
                data-testid="input-logo-url"
              />
            </div>
          </Field>
          <Field label="Division">
            <select
              value={form.division}
              onChange={(e) => setForm({ ...form, division: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="select-division"
            >
              {divisions.map((d: string) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Team count">
            <input
              type="number"
              min={1}
              max={5}
              value={form.teamCount}
              onChange={(e) =>
                setForm({ ...form, teamCount: Number(e.target.value) })
              }
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-teamcount"
            />
          </Field>

          <Field label="Additional divisions (optional)">
            <div className="flex flex-wrap gap-1.5">
              {divisions
                .filter((d: string) => d !== form.division)
                .map((d: string) => {
                  const on = form.additionalDivisions.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          additionalDivisions: on
                            ? form.additionalDivisions.filter(
                                (x: string) => x !== d,
                              )
                            : [...form.additionalDivisions, d],
                        })
                      }
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{
                        background: on ? `${BSL.cyan}22` : BSL.cardSoft,
                        color: on ? BSL.cyan : BSL.muted,
                        border: `1px solid ${on ? BSL.cyan : BSL.border}`,
                      }}
                      data-testid={`toggle-extra-division-${d}`}
                    >
                      {on ? "+ " : ""}
                      {d}
                    </button>
                  );
                })}
              {divisions.filter((d: string) => d !== form.division).length ===
                0 && (
                <span className="text-[10px]" style={{ color: BSL.faint }}>
                  Add more divisions in League Control to assign extras here.
                </span>
              )}
            </div>
            <div className="text-[10px] mt-1.5" style={{ color: BSL.faint }}>
              Primary stays{" "}
              <span className="font-bold text-white">{form.division}</span>.
              Extras tag the club as participating in additional divisions (used
              by division counts and roster filters). Each pair (team) still has
              its own division on the Players tab — that's what fixture
              generation uses.
            </div>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Toggle
              on={form.isFlagged}
              onChange={(v) => setForm({ ...form, isFlagged: v })}
              label="Flagged"
              icon={Flag}
              tone="gold"
              testid="toggle-flag"
            />
            <Toggle
              on={form.isSuspended}
              onChange={(v) => setForm({ ...form, isSuspended: v })}
              label="Suspended"
              icon={ShieldOff}
              tone="danger"
              testid="toggle-suspend"
            />
          </div>
          <Field label="Admin notes">
            <textarea
              value={form.adminNotes}
              onChange={(e) => setForm({ ...form, adminNotes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="textarea-notes"
            />
          </Field>

          <div
            className="pt-2 mt-1"
            style={{ borderTop: `1px solid ${BSL.border}` }}
          >
            <div
              className="text-[10px] uppercase tracking-widest font-black mb-2"
              style={{ color: BSL.cyan }}
            >
              Club Admins
            </div>
            <div className="text-[10px] mb-2" style={{ color: BSL.faint }}>
              Owner is implicit. Additional admins share full club powers (set
              captains, edit roster, set grades). Pick from active players only.
            </div>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {roster
                .filter(
                  (p: any) =>
                    p.status === "ACTIVE" && p.userId !== club.managerUserId,
                )
                .map((p: any) => {
                  const on = adminUserIds.includes(p.userId);
                  return (
                    <button
                      key={p.id}
                      disabled={setAdmins.isPending}
                      onClick={() =>
                        setAdmins.mutate(
                          on
                            ? adminUserIds.filter((id) => id !== p.userId)
                            : [...adminUserIds, p.userId],
                        )
                      }
                      className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-xs disabled:opacity-50"
                      style={{
                        background: on ? `${BSL.gold}22` : BSL.cardSoft,
                        color: on ? BSL.gold : "white",
                        border: `1px solid ${on ? BSL.gold : BSL.border}`,
                      }}
                      data-testid={`toggle-admin-${p.id}`}
                    >
                      <span className="font-bold">{p.displayName}</span>
                      <span className="text-[10px] uppercase tracking-widest">
                        {on ? "Admin" : "Member"}
                      </span>
                    </button>
                  );
                })}
              {roster.filter(
                (p: any) =>
                  p.status === "ACTIVE" && p.userId !== club.managerUserId,
              ).length === 0 && (
                <div className="text-[10px]" style={{ color: BSL.faint }}>
                  No additional active members in this club yet.
                </div>
              )}
            </div>
          </div>

          <div
            className="pt-2 mt-1"
            style={{ borderTop: `1px solid ${BSL.border}` }}
          >
            <div
              className="text-[10px] uppercase tracking-widest font-black mb-2"
              style={{ color: BSL.cyan }}
            >
              Reassign Owner
            </div>
            <div className="text-[10px] mb-2" style={{ color: BSL.faint }}>
              Current owner:{" "}
              <span className="font-bold text-white">
                user #{club.managerUserId}
              </span>
              . OWNER-only — picks the new club manager.
            </div>
            <input
              value={ownerSearch}
              onChange={(e) => setOwnerSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-owner-search"
            />
            {ownerCandidates && ownerCandidates.length > 0 && (
              <div
                className="mt-1 max-h-40 overflow-y-auto rounded-lg"
                style={{ border: `1px solid ${BSL.border}` }}
              >
                {ownerCandidates.slice(0, 8).map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => reassignOwner.mutate(u.id)}
                    disabled={
                      reassignOwner.isPending || u.id === club.managerUserId
                    }
                    className="w-full text-left px-3 py-2 text-xs hover:bg-white/5 disabled:opacity-40 flex items-center justify-between"
                    data-testid={`button-pick-owner-${u.id}`}
                  >
                    <span>
                      <span className="font-bold">{u.fullName}</span>{" "}
                      <span style={{ color: BSL.muted }}>· {u.email}</span>
                    </span>
                    {u.id === club.managerUserId && (
                      <span
                        className="text-[10px] uppercase"
                        style={{ color: BSL.gold }}
                      >
                        Current
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: BSL.cardSoft, color: BSL.muted }}
              data-testid="button-cancel"
            >
              Cancel
            </button>
            <ActionButton
              variant="gold"
              onClick={() => onSave(form)}
              icon={<Save className="h-3 w-3" />}
            >
              Save
            </ActionButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
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

// ---------------------------------------------------------------------------
// CREATE CLUB DIALOG — admin-only fast path that bypasses the public wizard.
// Spins up the bslClubs row + the requested number of pair (team) rows in
// one call. The current admin becomes managerUserId by default.
// ---------------------------------------------------------------------------
function CreateClubDialog({ divisions, onClose, onSubmit, submitting }: any) {
  const CATS = ["MD", "WD", "XD"] as const;
  const [form, setForm] = useState({
    name: "",
    division: divisions[0] || "Premier",
    additionalDivisions: [] as string[],
    logoUrl: "",
    status: "ACTIVE" as "ACTIVE" | "PENDING_PAYMENT",
    pairs: { MD: 1, WD: 1, XD: 1 } as Record<string, number>,
  });
  const total =
    (form.pairs.MD || 0) + (form.pairs.WD || 0) + (form.pairs.XD || 0);
  const valid = form.name.trim().length >= 2 && total > 0;
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
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl p-6"
        style={{
          background: BSL.card,
          border: `1px solid ${BSL.gold}55`,
          boxShadow: `0 24px 64px hsla(222,80%,2%,0.6), 0 0 0 1px ${BSL.gold}22`,
        }}
        onClick={(e) => e.stopPropagation()}
        data-testid="dialog-create-club"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-black uppercase tracking-tight">
            New <span style={{ color: BSL.gold }}>Club</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded"
            style={{ background: BSL.cardSoft }}
            data-testid="button-close-create-club"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Club name">
            <input
              autoFocus
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-create-club-name"
            />
          </Field>
          <Field label="Primary division">
            <select
              value={form.division}
              onChange={(e) =>
                setForm({
                  ...form,
                  division: e.target.value,
                  additionalDivisions: form.additionalDivisions.filter(
                    (d) => d !== e.target.value,
                  ),
                })
              }
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="select-create-club-division"
            >
              {divisions.map((d: string) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Additional divisions (optional)">
            <div className="flex flex-wrap gap-1.5">
              {divisions
                .filter((d: string) => d !== form.division)
                .map((d: string) => {
                  const on = form.additionalDivisions.includes(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          additionalDivisions: on
                            ? form.additionalDivisions.filter((x) => x !== d)
                            : [...form.additionalDivisions, d],
                        })
                      }
                      className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                      style={{
                        background: on ? `${BSL.cyan}22` : BSL.cardSoft,
                        color: on ? BSL.cyan : BSL.muted,
                        border: `1px solid ${on ? BSL.cyan : BSL.border}`,
                      }}
                      data-testid={`toggle-create-extra-division-${d}`}
                    >
                      {on ? "+ " : ""}
                      {d}
                    </button>
                  );
                })}
            </div>
          </Field>
          <Field label="Logo URL (optional)">
            <input
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://…"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-create-club-logo"
            />
          </Field>
          <Field label="Pairs per category">
            <div className="grid grid-cols-3 gap-2">
              {CATS.map((cat) => (
                <div
                  key={cat}
                  className="p-2 rounded-lg"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                  }}
                >
                  <div
                    className="text-[10px] font-black uppercase tracking-widest"
                    style={{ color: BSL.cyan }}
                  >
                    {cat}
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={form.pairs[cat]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        pairs: {
                          ...form.pairs,
                          [cat]: Math.max(
                            0,
                            Math.min(8, Number(e.target.value) || 0),
                          ),
                        },
                      })
                    }
                    className="w-full mt-1 px-2 py-1 rounded text-sm tabular-nums"
                    style={{
                      background: BSL.bg,
                      border: `1px solid ${BSL.border}`,
                      color: "white",
                    }}
                    data-testid={`input-pairs-${cat}`}
                  />
                </div>
              ))}
            </div>
            <div className="text-[10px] mt-1" style={{ color: BSL.faint }}>
              Total {total} pair{total === 1 ? "" : "s"}. Auto-creates pair
              rows.
            </div>
          </Field>
          <Field label="Status">
            <div className="grid grid-cols-2 gap-2">
              {(["ACTIVE", "PENDING_PAYMENT"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setForm({ ...form, status: s })}
                  className="px-3 py-2 rounded-lg text-xs font-black uppercase tracking-widest"
                  style={{
                    background:
                      form.status === s ? `${BSL.gold}22` : BSL.cardSoft,
                    color: form.status === s ? BSL.gold : BSL.muted,
                    border: `1px solid ${form.status === s ? BSL.gold : BSL.border}`,
                  }}
                  data-testid={`select-status-${s}`}
                >
                  {s === "ACTIVE" ? "Active (with invite)" : "Pending payment"}
                </button>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{ background: BSL.cardSoft, color: BSL.muted }}
              data-testid="button-cancel-create-club"
            >
              Cancel
            </button>
            <ActionButton
              variant="gold"
              disabled={!valid || submitting}
              onClick={() =>
                onSubmit({
                  name: form.name.trim(),
                  division: form.division,
                  additionalDivisions: form.additionalDivisions,
                  logoUrl: form.logoUrl || null,
                  status: form.status,
                  categoryPairs: form.pairs,
                })
              }
              icon={<Save className="h-3 w-3" />}
              testid="button-confirm-create-club"
            >
              {submitting ? "Creating…" : "Create club"}
            </ActionButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
function Toggle({ on, onChange, label, icon: Icon, tone, testid }: any) {
  const c = tone === "danger" ? BSL.danger : BSL.gold;
  return (
    <button
      onClick={() => onChange(!on)}
      className="flex items-center justify-between p-3 rounded-lg text-sm font-bold w-full"
      style={{
        background: on ? `${c}22` : BSL.cardSoft,
        border: `1px solid ${on ? c : BSL.border}`,
        color: on ? c : BSL.muted,
      }}
      data-testid={testid}
    >
      <span className="inline-flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      {on ? (
        <ShieldCheck className="h-4 w-4" />
      ) : (
        <span className="text-[10px]">OFF</span>
      )}
    </button>
  );
}
