import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CreditCard,
  Check,
  X,
  Download,
  History,
  Wallet as WalletIcon,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type TxStatus = "PENDING" | "APPROVED" | "REJECTED";

type Transaction = {
  id: number;
  bslPlayerId: number;
  type: string;
  amount: number;
  status: TxStatus;
  proofUrl: string | null;
  paymentDate: string;
  payerAccountName: string;
  reference: string;
  description: string;
  reviewedById: number | null;
  reviewedAt: string | null;
  createdAt: string;
  player: {
    id: number;
    userId: number;
    displayName: string;
    user: { id: number; fullName: string; email: string };
  };
};

const TX_COLOR: Record<TxStatus, string> = {
  PENDING: BSL.gold,
  APPROVED: BSL.success,
  REJECTED: BSL.danger,
};

function Queue({ title, tone, items, renderItem }: any) {
  return (
    <GlowPanel
      title={title}
      subtitle={`${items?.length || 0} awaiting`}
      tone={tone}
    >
      {!items?.length ? (
        <div className="py-6 text-center text-sm" style={{ color: BSL.muted }}>
          Queue clear · all approvals up to date.
        </div>
      ) : (
        <div className="space-y-2">{items.map(renderItem)}</div>
      )}
    </GlowPanel>
  );
}

function Row({ left, pay, actions, testid }: any) {
  const hasPay = pay && (pay.amount != null || pay.date || pay.payer);
  const fmtDate = pay?.date
    ? new Date(pay.date).toLocaleDateString("en-GB")
    : "—";
  const fmtAmount =
    typeof pay?.amount === "number" ? `£${(pay.amount / 100).toFixed(2)}` : "—";
  return (
    <div
      className="flex flex-wrap items-center gap-3 p-3 rounded-lg"
      style={{ background: "hsla(0,0%,100%,0.03)" }}
      data-testid={testid}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">{left}</div>
      {hasPay && (
        <div
          className="text-[10px] inline-flex flex-col gap-0.5 px-3 py-1.5 rounded-lg"
          style={{
            background: `${BSL.cyan}14`,
            color: BSL.cyan,
            border: `1px solid ${BSL.cyan}33`,
          }}
        >
          <span className="font-mono font-bold">
            {fmtAmount} · {fmtDate}
          </span>
          <span
            className="text-white/70 truncate max-w-[180px]"
            title={pay?.payer || ""}
          >
            {pay?.payer || "No name supplied"}
          </span>
        </div>
      )}
      <div className="flex gap-1">{actions}</div>
    </div>
  );
}

export default function PaymentsAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [tab, setTab] = useState<"pending" | "history">("pending");

  const { data: transactions } = useQuery<Transaction[]>({
    queryKey: ["/api/bsl/admin/transactions"],
    refetchInterval: 15000,
  });

  const inv = () => {
    qc.invalidateQueries({ queryKey: ["/api/bsl/admin/transactions"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/admin/dashboard"] });
  };

  const onError = (e: any) =>
    toast({
      title: "Action failed",
      description: e?.message || "Unknown error",
      variant: "destructive",
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
    onSuccess: () => {
      inv();
      toast({ title: "Top-up approved" });
    },
    onError,
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
    onSuccess: () => inv(),
    onError,
  });

  const pendingTx = transactions?.filter((t) => t.status === "PENDING") ?? [];
  const totalPending = pendingTx.length;

  return (
    <AdminLayout active="payments">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            Payments <span style={{ color: BSL.gold }}>Hub</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: BSL.muted }}>
            Bank-transfer verification · approval queue · wallet credits · CSV
            export
          </p>
        </div>
        <a
          href="/api/bsl/admin/payments/export.csv"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
          style={{
            background: `${BSL.cyan}22`,
            color: BSL.cyan,
            border: `1px solid ${BSL.cyan}55`,
          }}
          data-testid="link-export-csv"
        >
          <Download className="h-3 w-3" /> Export CSV
        </a>
      </div>

      <div className="flex gap-2 mb-5">
        {[
          { k: "pending", l: `Pending (${totalPending})`, i: CreditCard },
          { k: "history", l: "History", i: History },
        ].map(({ k, l, i: Icon }) => (
          <button
            key={k}
            onClick={() => setTab(k as any)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black uppercase tracking-widest"
            style={{
              background: tab === k ? BSL.gold : BSL.cardSoft,
              color: tab === k ? BSL.bgDeep : "white",
              border: `1px solid ${tab === k ? BSL.gold : BSL.border}`,
            }}
            data-testid={`tab-${k}`}
          >
            <Icon className="h-3 w-3" /> {l}
          </button>
        ))}
      </div>

      {tab === "pending" && (
        <div className="space-y-5">
          <Queue
            title="Wallet Top-Ups"
            tone="gold"
            items={pendingTx}
            renderItem={(transaction: Transaction) => (
              <Row
                key={transaction.id}
                testid={`pending-tx-${transaction.id}`}
                left={
                  <>
                    <WalletIcon
                      className="h-5 w-5"
                      style={{ color: BSL.gold }}
                    />
                    <div>
                      <div className="font-bold">
                        £{(transaction.amount / 100).toFixed(2)} ·{" "}
                        {transaction.description || transaction.type}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.muted }}
                      >
                        <span data-testid={`text-tx-player-${transaction.id}`}>
                          {transaction.player?.displayName || `Player #${transaction.bslPlayerId}`}
                        </span>{" "}
                        · ref {transaction.reference}
                      </div>
                    </div>
                  </>
                }
                pay={{
                  amount: transaction.amount,
                  date: transaction.paymentDate,
                  payer: transaction.payerAccountName,
                }}
                actions={
                  <>
                    <ActionButton
                      variant="gold"
                      onClick={() => approveTx.mutate(transaction.id)}
                      icon={<Check className="h-3 w-3" />}
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      variant="danger"
                      onClick={() => rejectTx.mutate(transaction.id)}
                      icon={<X className="h-3 w-3" />}
                    >
                      Reject
                    </ActionButton>
                  </>
                }
              />
            )}
          />
        </div>
      )}

      {tab === "history" && (
        <GlowPanel
          title="Wallet Transaction History"
          tone="cyan"
          icon={<History className="h-4 w-4" />}
        >
          {!transactions?.length ? (
            <div
              className="py-10 text-center text-sm"
              style={{ color: BSL.muted }}
            >
              No transactions recorded.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr
                    className="text-[10px] uppercase tracking-widest"
                    style={{ color: BSL.muted }}
                  >
                    <th className="text-left px-2 py-2">When</th>
                    <th className="text-left px-2 py-2">Player</th>
                    <th className="text-left px-2 py-2">Type</th>
                    <th className="text-right px-2 py-2">Amount</th>
                    <th className="text-left px-2 py-2">Status</th>
                    <th className="text-left px-2 py-2">Ref</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions?.map((t: Transaction) => (
                    <tr
                      key={t.id}
                      className="border-t"
                      style={{ borderColor: BSL.border }}
                      data-testid={`tx-${t.id}`}
                    >
                      <td className="px-2 py-2 text-xs">
                        {new Date(t.createdAt).toLocaleString("en-GB")}
                      </td>
                      <td
                        className="px-2 py-2"
                        data-testid={`text-history-player-${t.id}`}
                      >
                        {t.player?.displayName || `Player #${t.bslPlayerId}`}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="text-[10px] font-black uppercase tracking-widest"
                          style={{
                            color: t.type === "TOPUP" ? BSL.success : BSL.gold,
                          }}
                        >
                          {t.type}
                        </span>
                      </td>
                      <td
                        className="px-2 py-2 text-right tabular-nums font-bold"
                        style={{ color: BSL.gold }}
                      >
                        £{(t.amount / 100).toFixed(2)}
                      </td>
                      <td className="px-2 py-2">
                        <span
                          className="text-[10px] uppercase font-black px-2 py-0.5 rounded"
                          style={{
                            background: `${TX_COLOR[t.status]}22`,
                            color: TX_COLOR[t.status],
                          }}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td
                        className="px-2 py-2 text-[10px] font-mono"
                        style={{ color: BSL.faint }}
                      >
                        {t.reference}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlowPanel>
      )}
    </AdminLayout>
  );
}
