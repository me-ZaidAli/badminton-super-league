import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/routing";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  X,
  Shield,
  Users,
  Wallet as WalletIcon,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function AdminVerify() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: pending } = useQuery<any>({
    queryKey: ["/api/bsl/admin/pending"],
  });

  const m = (path: string) =>
    useMutation({
      mutationFn: async (body: any) =>
        (await apiRequest("PATCH", path.replace(":id", body.id), body)).json(),
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] });
        qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
        toast({ title: "Updated" });
      },
      onError: (e: any) =>
        toast({
          title: "Failed",
          description: e.message,
          variant: "destructive",
        }),
    });

  const approveClub = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/bsl/clubs/${id}/approve`, {})).json(),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
      toast({
        title: "Club approved",
        description: `Invite code: ${data.inviteCode}`,
      });
    },
  });
  const rejectClub = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest("PATCH", `/api/bsl/clubs/${id}/reject`, {
          reason: "Rejected by admin",
        })
      ).json(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] }),
  });
  const approvePlayer = useMutation({
    mutationFn: async (id: number) =>
      (await apiRequest("PATCH", `/api/bsl/players/${id}/approve`, {})).json(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] }),
  });
  const rejectPlayer = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest("PATCH", `/api/bsl/players/${id}/reject`, {
          reason: "Rejected by admin",
        })
      ).json(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] }),
  });
  const approveTx = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest(
          "PATCH",
          `/api/bsl/wallet/transactions/${id}/approve`,
          {},
        )
      ).json(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] }),
  });
  const rejectTx = useMutation({
    mutationFn: async (id: number) =>
      (
        await apiRequest(
          "PATCH",
          `/api/bsl/wallet/transactions/${id}/reject`,
          {},
        )
      ).json(),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/pending"] }),
  });

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <div className="max-w-5xl mx-auto px-4 md:px-8 pt-8">
        <Link href="/">
          <a
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
            style={{ color: BSL.muted }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to BSL
          </a>
        </Link>
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-2">
          Admin <span style={{ color: BSL.gold }}>Verify</span>
        </h1>
        <p className="text-sm mb-8" style={{ color: BSL.muted }}>
          Approve bank transfers to unlock clubs, players, wallet credits.
        </p>

        <div className="space-y-5">
          <GlowPanel
            title="Pending Clubs"
            subtitle={`${pending?.clubs?.length || 0} awaiting`}
            tone="gold"
            icon={<Shield className="h-4 w-4" />}
          >
            {!pending?.clubs?.length ? (
              <div
                className="py-6 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                No pending club registrations.
              </div>
            ) : (
              <div className="space-y-2">
                {pending.clubs.map((c: any) => (
                  <div
                    key={c.id}
                    className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
                    style={{ background: "hsla(0,0%,100%,0.03)" }}
                    data-testid={`pending-club-${c.id}`}
                  >
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center text-xs font-black overflow-hidden"
                      style={{ background: `${BSL.gold}22`, color: BSL.gold }}
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
                    <div className="flex-1 min-w-0">
                      <div className="font-bold truncate">{c.name}</div>
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.muted }}
                      >
                        {c.division} · {c.teamCount} team
                        {c.teamCount > 1 ? "s" : ""} · ref {c.paymentReference}
                      </div>
                    </div>
                    <PayDetails
                      amount={c.paymentAmountPence}
                      date={c.paymentDate}
                      payer={c.payerAccountName}
                      testid={`paydetails-club-${c.id}`}
                    />
                    <ActionButton
                      variant="gold"
                      onClick={() => approveClub.mutate(c.id)}
                      icon={<Check className="h-3 w-3" />}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      onClick={() => rejectClub.mutate(c.id)}
                      icon={<X className="h-3 w-3" />}
                    >
                      Reject
                    </ActionButton>
                  </div>
                ))}
              </div>
            )}
          </GlowPanel>

          <GlowPanel
            title="Pending Players"
            subtitle={`${pending?.players?.length || 0} awaiting`}
            tone="cyan"
            icon={<Users className="h-4 w-4" />}
          >
            {!pending?.players?.length ? (
              <div
                className="py-6 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                No pending players.
              </div>
            ) : (
              <div className="space-y-2">
                {pending.players.map((p: any) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
                    style={{ background: "hsla(0,0%,100%,0.03)" }}
                    data-testid={`pending-player-${p.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div
                        className="font-bold"
                        data-testid={`text-player-name-${p.id}`}
                      >
                        {p.displayName || `Player #${p.userId}`}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.muted }}
                      >
                        {p.email ? `${p.email} · ` : ""}ref {p.paymentReference}
                      </div>
                    </div>
                    <PayDetails
                      amount={p.paymentAmountPence}
                      date={p.paymentDate}
                      payer={p.payerAccountName}
                      testid={`paydetails-player-${p.id}`}
                    />
                    <ActionButton
                      variant="cyan"
                      onClick={() => approvePlayer.mutate(p.id)}
                      icon={<Check className="h-3 w-3" />}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      onClick={() => rejectPlayer.mutate(p.id)}
                      icon={<X className="h-3 w-3" />}
                    >
                      Reject
                    </ActionButton>
                  </div>
                ))}
              </div>
            )}
          </GlowPanel>

          <GlowPanel
            title="Pending Wallet Top-Ups"
            subtitle={`${pending?.wallets?.length || 0} awaiting`}
            tone="gold"
            icon={<WalletIcon className="h-4 w-4" />}
          >
            {!pending?.wallets?.length ? (
              <div
                className="py-6 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                No pending top-ups.
              </div>
            ) : (
              <div className="space-y-2">
                {pending.wallets.map((w: any) => (
                  <div
                    key={w.id}
                    className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
                    style={{ background: "hsla(0,0%,100%,0.03)" }}
                    data-testid={`pending-tx-${w.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-bold">
                        £{(w.amount / 100).toFixed(2)} ·{" "}
                        {w.description || w.type}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.muted }}
                      >
                        <span data-testid={`text-pending-tx-player-${w.id}`}>
                          {w.playerName ||
                            (w.bslPlayerId ? `Player #${w.bslPlayerId}` : "—")}
                        </span>{" "}
                        · ref {w.reference}
                      </div>
                    </div>
                    <PayDetails
                      amount={w.amount}
                      date={w.paymentDate}
                      payer={w.payerAccountName}
                      testid={`paydetails-tx-${w.id}`}
                    />
                    <ActionButton
                      variant="gold"
                      onClick={() => approveTx.mutate(w.id)}
                      icon={<Check className="h-3 w-3" />}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      onClick={() => rejectTx.mutate(w.id)}
                      icon={<X className="h-3 w-3" />}
                    >
                      Reject
                    </ActionButton>
                  </div>
                ))}
              </div>
            )}
          </GlowPanel>
        </div>
      </div>
    </div>
  );
}

function PayDetails({
  amount,
  date,
  payer,
  testid,
}: {
  amount?: number | null;
  date?: string | null;
  payer?: string | null;
  testid?: string;
}) {
  if (amount == null && !date && !payer) return null;
  const fmtDate = date ? new Date(date).toLocaleDateString("en-GB") : "—";
  const fmtAmount =
    typeof amount === "number" ? `£${(amount / 100).toFixed(2)}` : "—";
  return (
    <div
      className="text-[10px] inline-flex flex-col gap-0.5 px-3 py-1.5 rounded-lg"
      style={{
        background: `${BSL.cyan}14`,
        color: BSL.cyan,
        border: `1px solid ${BSL.cyan}33`,
      }}
      data-testid={testid}
    >
      <span className="font-mono font-bold">
        {fmtAmount} · {fmtDate}
      </span>
      <span
        className="text-white/70 truncate max-w-[180px]"
        title={payer || ""}
      >
        {payer || "No name supplied"}
      </span>
    </div>
  );
}
