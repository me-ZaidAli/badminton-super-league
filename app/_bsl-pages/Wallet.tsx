import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/routing";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Plus,
  Wallet as WalletIcon,
  Receipt,
  Check,
  X,
  Hourglass,
  Copy,
  Banknote,
  RotateCcw,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BslSubNav } from "@/components/BslSubNav";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import {
  computeTopup,
  summariseByPackage,
  type TopupPackage,
} from "@/lib/topupPricing";

export default function Wallet() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [showTopup, setShowTopup] = useState(false);
  // Ordered click history — each entry is a packageId. Pressing the same
  // package N times produces N entries, which the pricing engine then ranks
  // 1st/2nd/3rd/… for discount purposes. Capped at MAX_CLICKS to match the
  // server's truncation (server: `slice(0, 200)`) so the displayed total
  // always equals the charged total.
  const MAX_CLICKS = 200;
  const [clicks, setClicks] = useState<string[]>([]);
  const [customPounds, setCustomPounds] = useState<string>("");
  const [payDate, setPayDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [payerName, setPayerName] = useState<string>("");

  const { data: wallet } = useQuery<any>({ queryKey: ["/api/bsl/wallet/me"] });
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });

  const packages: TopupPackage[] = useMemo(() => {
    const raw = (league?.topupPackages || []) as any[];
    return raw
      .map((p, i) => ({
        id: String(p.id || `pkg_${i + 1}`),
        label: String(p.label || ""),
        amountPence: Number(p.amountPence) || 0,
        sortOrder: Number(p.sortOrder ?? i),
      }))
      .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  }, [league?.topupPackages]);
  const discountPcts: number[] = useMemo(() => {
    // MUST mirror server fallback exactly (server: `league?.topupDiscountPcts || [0,50,70]`).
    // An empty array on the league means "no discounts" — keep it empty here too,
    // otherwise the displayed total would diverge from what the server charges.
    const raw = league?.topupDiscountPcts;
    if (Array.isArray(raw)) return raw.map((n: any) => Number(n) || 0);
    return [0, 50, 70];
  }, [league?.topupDiscountPcts]);

  const customPence = useMemo(() => {
    const n = parseFloat(customPounds);
    return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  }, [customPounds]);

  // Live recompute on every click — same engine the server uses, so the total
  // shown here is the exact total that will be charged.
  const summary = useMemo(
    () => computeTopup(clicks, packages, discountPcts, customPence),
    [clicks, packages, discountPcts, customPence],
  );
  const grouped = useMemo(
    () => summariseByPackage(summary.lines),
    [summary.lines],
  );

  const topupMutation = useMutation({
    mutationFn: async () => {
      if (summary.totalPence <= 0)
        throw new Error("Add at least one package or a custom amount.");

      if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate))
        throw new Error("Pick the date you sent the transfer.");

      if (payerName.trim().length < 2)
        throw new Error("Enter the bank account name you paid from.");

      const r = await fetch("/api/bsl/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          clickHistory: clicks,
          customAmountPence: customPence > 0 ? customPence : undefined,
          paymentDate: payDate,
          payerAccountName: payerName.trim(),
        }),
      });

      if (!r.ok) throw new Error(await r.text());

      return r.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/wallet/me"] });
      setShowTopup(false);
      setPayerName("");
      setClicks([]);
      setCustomPounds("");
      toast({
        title: "Top-up submitted",
        description: "Awaiting admin approval.",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const balance = wallet?.balance || 0;
  const txs = wallet?.transactions || [];
  const reset = () => {
    setClicks([]);
    setCustomPounds("");
  };

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-8">
        <Link href="/">
          <a
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
            style={{ color: BSL.muted }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to BSL
          </a>
        </Link>
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-8">
          BSL <span style={{ color: BSL.gold }}>Wallet</span>
        </h1>

        {/* Balance card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-2xl p-6 mb-6"
          style={{
            background: `linear-gradient(135deg, ${BSL.gold}22, hsla(222,40%,12%,0.95) 60%)`,
            border: `1px solid ${BSL.gold}55`,
            boxShadow: `0 24px 60px -20px ${BSL.gold}44`,
          }}
        >
          <div
            className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-30 blur-3xl"
            style={{ background: BSL.gold }}
          />
          <div className="relative flex items-start justify-between">
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.3em] mb-2 font-bold"
                style={{ color: BSL.gold }}
              >
                Available Balance
              </div>
              <motion.div
                key={balance}
                initial={{ scale: 1.1, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl md:text-6xl font-black tabular-nums"
                style={{
                  color: BSL.text,
                  textShadow: `0 0 40px ${BSL.gold}66`,
                }}
                data-testid="text-balance"
              >
                £{(balance / 100).toFixed(2)}
              </motion.div>
              <div className="text-xs mt-2" style={{ color: BSL.muted }}>
                For league entry, kit, food & drink at the venue.
              </div>
            </div>
            <WalletIcon className="h-10 w-10" style={{ color: BSL.gold }} />
          </div>
          <div className="mt-5 flex gap-3">
            <ActionButton
              variant="gold"
              onClick={() => setShowTopup(true)}
              icon={<Plus className="h-4 w-4" />}
            >
              Top Up
            </ActionButton>
          </div>
        </motion.div>

        {/* Transactions */}
        <GlowPanel
          title="Transactions"
          subtitle={`${txs.length} total`}
          tone="cyan"
        >
          {txs.length === 0 ? (
            <div
              className="py-10 text-center text-sm"
              style={{ color: BSL.muted }}
            >
              No transactions yet. Top up to get started.
            </div>
          ) : (
            <div className="space-y-2">
              {txs.map((tx: any) => {
                const isCredit = tx.type === "TOPUP";
                const tone =
                  tx.status === "APPROVED"
                    ? BSL.success
                    : tx.status === "REJECTED"
                      ? BSL.danger
                      : BSL.gold;
                const Icon =
                  tx.status === "APPROVED"
                    ? Check
                    : tx.status === "REJECTED"
                      ? X
                      : Hourglass;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-3 py-3 rounded-lg"
                    style={{ background: "hsla(0,0%,100%,0.03)" }}
                    data-testid={`tx-${tx.id}`}
                  >
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center"
                      style={{ background: `${tone}22`, color: tone }}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">
                        {tx.description || tx.type}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.muted }}
                      >
                        {tx.reference} · {tx.status}
                      </div>
                    </div>
                    <div
                      className="text-base font-black tabular-nums"
                      style={{ color: isCredit ? BSL.success : BSL.danger }}
                    >
                      {isCredit ? "+" : "−"}£{(tx.amount / 100).toFixed(2)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </GlowPanel>
      </div>

      {/* Top-up modal */}
      <AnimatePresence>
        {showTopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{
              background: "hsla(222, 60%, 4%, 0.85)",
              backdropFilter: "blur(8px)",
            }}
            onClick={() => setShowTopup(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="w-full max-w-lg rounded-2xl overflow-hidden max-h-[90vh] flex flex-col"
              style={{
                background: BSL.card,
                border: `1px solid ${BSL.gold}55`,
                boxShadow: `0 32px 80px -20px ${BSL.gold}44`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="px-5 py-4 flex items-center justify-between shrink-0"
                style={{ borderBottom: `1px solid hsla(0,0%,100%,0.08)` }}
              >
                <div className="flex items-center gap-2">
                  <Banknote className="h-5 w-5" style={{ color: BSL.gold }} />
                  <span className="font-bold uppercase tracking-widest text-sm">
                    Top Up Wallet
                  </span>
                </div>
                <button
                  onClick={() => setShowTopup(false)}
                  className="p-1 rounded hover:bg-white/10"
                  data-testid="button-close-topup"
                >
                  <X className="h-4 w-4" style={{ color: BSL.muted }} />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                {/* Package buttons */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label
                      className="text-xs uppercase tracking-widest font-bold"
                      style={{ color: BSL.muted }}
                    >
                      Pick categories
                    </label>
                    {(clicks.length > 0 || customPence > 0) && (
                      <button
                        onClick={reset}
                        className="text-[10px] uppercase tracking-widest font-bold inline-flex items-center gap-1 px-2 py-1 rounded"
                        style={{
                          background: `${BSL.danger}22`,
                          color: BSL.danger,
                        }}
                        data-testid="button-reset-topup"
                      >
                        <RotateCcw className="h-3 w-3" /> Restart
                      </button>
                    )}
                  </div>
                  {packages.length === 0 ? (
                    <div
                      className="text-xs italic px-3 py-3 rounded-lg"
                      style={{
                        background: "hsla(0,0%,100%,0.04)",
                        color: BSL.muted,
                      }}
                    >
                      No packages configured yet. Use the custom amount field
                      below, or ask an admin to add packages in Settings.
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {packages.map((p) => {
                        const qty =
                          grouped.find((g) => g.id === p.id)?.qty ?? 0;
                        return (
                          <button
                            key={p.id}
                            onClick={() =>
                              setClicks((prev) => {
                                if (prev.length >= MAX_CLICKS) {
                                  toast({
                                    title: "Maximum reached",
                                    description: `Top-up capped at ${MAX_CLICKS} items per submission.`,
                                    variant: "destructive",
                                  });
                                  return prev;
                                }
                                return [...prev, p.id];
                              })
                            }
                            className="relative px-3 py-3 rounded-lg text-left transition-all active:scale-[0.98]"
                            style={{
                              background:
                                qty > 0
                                  ? `${BSL.gold}1a`
                                  : "hsla(0,0%,100%,0.04)",
                              border: `1px solid ${qty > 0 ? BSL.gold : "hsla(0,0%,100%,0.1)"}`,
                            }}
                            data-testid={`button-package-${p.id}`}
                          >
                            <div
                              className="text-sm font-bold truncate"
                              style={{ color: qty > 0 ? BSL.gold : BSL.text }}
                            >
                              {p.label}
                            </div>
                            <div
                              className="text-xs mt-0.5 tabular-nums"
                              style={{ color: BSL.muted }}
                            >
                              £{(p.amountPence / 100).toFixed(2)}
                            </div>
                            {qty > 0 && (
                              <div
                                className="absolute -top-2 -right-2 h-6 min-w-6 px-1.5 rounded-full text-[11px] font-black flex items-center justify-center"
                                style={{ background: BSL.gold, color: BSL.bg }}
                                data-testid={`badge-qty-${p.id}`}
                              >
                                ×{qty}
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom amount */}
                <div>
                  <label
                    className="text-xs uppercase tracking-widest font-bold mb-2 block"
                    style={{ color: BSL.muted }}
                  >
                    Custom amount (£)
                  </label>
                  <div className="relative">
                    <span
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: BSL.muted }}
                    >
                      £
                    </span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      placeholder="0.00"
                      value={customPounds}
                      onChange={(e) =>
                        setCustomPounds(e.target.value.replace(/^0+(?=\d)/, ""))
                      }
                      className="w-full pl-7 pr-3 py-2 rounded-lg text-white outline-none"
                      style={{
                        background: "hsla(0,0%,100%,0.05)",
                        border: `1px solid hsla(0,0%,100%,0.15)`,
                      }}
                      data-testid="input-custom-amount"
                    />
                  </div>
                  <div
                    className="text-[10px] mt-1"
                    style={{ color: BSL.faint }}
                  >
                    Custom amounts never get a discount.
                  </div>
                </div>

                {/* Live breakdown */}
                {(summary.lines.length > 0 || customPence > 0) && (
                  <div
                    className="rounded-xl p-3 space-y-1.5"
                    style={{
                      background: "hsla(0,0%,100%,0.04)",
                      border: `1px solid hsla(0,0%,100%,0.1)`,
                    }}
                    data-testid="topup-breakdown"
                  >
                    <div
                      className="text-[10px] uppercase tracking-widest font-bold mb-1"
                      style={{ color: BSL.gold }}
                    >
                      Breakdown
                    </div>
                    {summary.lines.map((line, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono opacity-60 w-6">
                            #{line.rank}
                          </span>
                          <span className="truncate">{line.label}</span>
                          {line.discountPct > 0 && (
                            <span
                              className="text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded"
                              style={{
                                background: `${BSL.success}22`,
                                color: BSL.success,
                              }}
                            >
                              −{line.discountPct}%
                            </span>
                          )}
                        </div>
                        <div className="tabular-nums shrink-0 ml-2">
                          {line.discountPct > 0 ? (
                            <>
                              <span className="line-through opacity-50 mr-1.5">
                                £{(line.basePence / 100).toFixed(2)}
                              </span>
                              <span
                                className="font-bold"
                                style={{ color: BSL.success }}
                              >
                                £{(line.finalPence / 100).toFixed(2)}
                              </span>
                            </>
                          ) : (
                            <span className="font-bold">
                              £{(line.finalPence / 100).toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {customPence > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span>Custom amount</span>
                        <span className="font-bold tabular-nums">
                          £{(customPence / 100).toFixed(2)}
                        </span>
                      </div>
                    )}
                    <div
                      className="pt-2 mt-2 space-y-1"
                      style={{ borderTop: `1px solid hsla(0,0%,100%,0.1)` }}
                    >
                      {summary.discountPence > 0 && (
                        <div
                          className="flex justify-between text-xs"
                          style={{ color: BSL.success }}
                        >
                          <span>Discount applied</span>
                          <span className="tabular-nums font-bold">
                            −£{(summary.discountPence / 100).toFixed(2)}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between items-baseline">
                        <span
                          className="text-xs uppercase tracking-widest font-bold"
                          style={{ color: BSL.muted }}
                        >
                          Total
                        </span>
                        <motion.span
                          key={summary.totalPence}
                          initial={{ scale: 1.1 }}
                          animate={{ scale: 1 }}
                          className="text-2xl font-black tabular-nums"
                          style={{ color: BSL.gold }}
                          data-testid="text-topup-total"
                        >
                          £{(summary.totalPence / 100).toFixed(2)}
                        </motion.span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bank details */}
                <div
                  className="rounded-xl p-3"
                  style={{
                    background: `${BSL.cyan}10`,
                    border: `1px solid ${BSL.cyan}33`,
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-widest font-bold mb-2"
                    style={{ color: BSL.cyan }}
                  >
                    Bank Details
                  </div>
                  {[
                    ["Account", league?.bankAccountName],
                    ["Sort", league?.bankSortCode],
                    ["Number", league?.bankAccountNumber],
                  ].map(([k, v]) => (
                    <div
                      key={k as string}
                      className="flex justify-between text-xs py-1"
                    >
                      <span style={{ color: BSL.muted }}>{k}</span>
                      <span className="font-mono font-bold flex items-center gap-1.5">
                        {v}
                        <button
                          onClick={() =>
                            navigator.clipboard.writeText(String(v))
                          }
                        >
                          <Copy
                            className="h-3 w-3"
                            style={{ color: BSL.cyan }}
                          />
                        </button>
                      </span>
                    </div>
                  ))}
                </div>

                {/* Payment details (no picture upload — admin cross-checks the bank statement) */}
                <div
                  className="rounded-xl p-3 space-y-3"
                  style={{
                    background: "hsla(0,0%,100%,0.04)",
                    border: `1px solid ${BSL.cyan}33`,
                  }}
                >
                  <div
                    className="text-[10px] uppercase tracking-widest font-bold"
                    style={{ color: BSL.cyan }}
                  >
                    Your Payment Details
                  </div>
                  <label className="block">
                    <div
                      className="text-[10px] uppercase tracking-widest mb-1 font-bold"
                      style={{ color: BSL.muted }}
                    >
                      Date of payment
                    </div>
                    <input
                      type="date"
                      value={payDate}
                      onChange={(e) => setPayDate(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm font-mono outline-none"
                      style={{
                        background: "hsla(0,0%,100%,0.06)",
                        border: `1px solid ${BSL.cyan}33`,
                        color: "white",
                      }}
                      data-testid="input-topup-pay-date"
                    />
                  </label>
                  <label className="block">
                    <div
                      className="text-[10px] uppercase tracking-widest mb-1 font-bold"
                      style={{ color: BSL.muted }}
                    >
                      Account name (payer)
                    </div>
                    <input
                      type="text"
                      maxLength={120}
                      value={payerName}
                      onChange={(e) => setPayerName(e.target.value)}
                      placeholder="Name on the bank account you paid from"
                      className="w-full px-3 py-2 rounded-lg text-sm outline-none"
                      style={{
                        background: "hsla(0,0%,100%,0.06)",
                        border: `1px solid ${BSL.cyan}33`,
                        color: "white",
                      }}
                      data-testid="input-topup-payer-name"
                    />
                  </label>
                </div>

                <ActionButton
                  variant="gold"
                  fullWidth
                  onClick={() => topupMutation.mutate()}
                  loading={topupMutation.isPending}
                  disabled={summary.totalPence <= 0}
                  testid="button-submit-topup"
                >
                  Submit £{(summary.totalPence / 100).toFixed(2)} Top-Up
                </ActionButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
