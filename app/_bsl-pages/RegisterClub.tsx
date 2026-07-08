import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "@/lib/routing";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Copy,
  Building2,
  ImageIcon,
  Award,
  Users,
  Banknote,
  Hourglass,
  Sparkles,
  Receipt,
  Upload,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const STEPS = [
  { key: "details", label: "Club Details", icon: Building2 },
  { key: "logo", label: "Logo", icon: ImageIcon },
  { key: "division", label: "Division", icon: Award },
  { key: "categories", label: "Categories", icon: Users },
  { key: "payment", label: "Bank Transfer", icon: Banknote },
  { key: "proof", label: "Payment Details", icon: Receipt },
  { key: "done", label: "Pending", icon: Hourglass },
];

export default function RegisterClub() {
  const [, setLoc] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [division, setDivision] = useState("");
  const [categoryPairs, setCategoryPairs] = useState<Record<string, number>>({
    MD: 0,
    WD: 0,
    XD: 0,
  });
  const totalPairs = Object.values(categoryPairs).reduce((s, n) => s + n, 0);
  const adjustPairs = (cat: string, delta: number) =>
    setCategoryPairs((prev) => ({
      ...prev,
      [cat]: Math.max(0, Math.min(8, (prev[cat] || 0) + delta)),
    }));
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [payAmount, setPayAmount] = useState<string>(""); // pounds
  const [payDate, setPayDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [payerName, setPayerName] = useState<string>("");
  const [createdClub, setCreatedClub] = useState<any>(null);

  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });

  const createMutation = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/bsl/clubs", {
        name,
        division,
        categoryPairs,
        logoUrl,
      });
      return r.json();
    },
    onSuccess: (club) => {
      setCreatedClub(club);
      qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
      setStep(4);
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const uploadProofMutation = useMutation({
    mutationFn: async () => {
      if (!createdClub) throw new Error("Missing club");
      const amount = Math.round(parseFloat(payAmount) * 100);
      if (!Number.isFinite(amount) || amount <= 0)
        throw new Error("Enter a positive payment amount.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(payDate))
        throw new Error("Pick the date you sent the transfer.");
      if (payerName.trim().length < 2)
        throw new Error("Enter the bank account name you paid from.");
      const r = await apiRequest(
        "POST",
        `/api/bsl/clubs/${createdClub.id}/payment-proof`,
        {
          paymentAmountPence: amount,
          paymentDate: payDate,
          payerAccountName: payerName.trim(),
        },
      );
      return r.json();
    },
    onSuccess: (updated) => {
      setCreatedClub(updated);
      qc.invalidateQueries({ queryKey: ["/api/bsl/clubs"] });
      setStep(6);
    },
    onError: (e: any) =>
      toast({
        title: "Could not submit",
        description: e.message,
        variant: "destructive",
      }),
  });

  const handleLogoFile = async (file: File) => {
    setLogoFile(file);
    // Upload via existing club logo endpoint (returns /uploads/clubs/...)
    const fd = new FormData();
    fd.append("logo", file);
    try {
      const r = await fetch("/api/bsl/clubs/logo-upload", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (r.ok) {
        const d = await r.json();
        setLogoUrl(d.logoUrl || d.url || null);
      } else {
        // Fallback: data URL preview only
        const reader = new FileReader();
        reader.onload = () => setLogoUrl(reader.result as string);
        reader.readAsDataURL(file);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => setLogoUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canProceed = (() => {
    if (step === 0) return name.trim().length >= 2;
    if (step === 1) return true; // logo optional
    if (step === 2) return !!division;
    if (step === 3) return totalPairs > 0;
    return true;
  })();

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <div className="max-w-3xl mx-auto px-4 md:px-8 pt-8">
        <Link href="/">
          <a
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
            style={{ color: BSL.muted }}
            data-testid="link-back"
          >
            <ArrowLeft className="h-3 w-3" /> Back to BSL
          </a>
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-2"
        >
          Register <span style={{ color: BSL.gold }}>Your Club</span>
        </motion.h1>
        <p className="text-sm mb-8" style={{ color: BSL.muted }}>
          Join the Birmingham Super League. £
          {((league?.clubFee || 0) / 100).toFixed(0)} entry covers your slot for
          the season.
        </p>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const active = i === step;
            const done = i < step;
            return (
              <div key={s.key} className="flex items-center shrink-0">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: done
                      ? BSL.gold
                      : active
                        ? `${BSL.gold}33`
                        : "hsla(0,0%,100%,0.06)",
                    border: `1px solid ${done || active ? BSL.gold : "hsla(0,0%,100%,0.15)"}`,
                    color: done
                      ? "hsl(222,50%,8%)"
                      : active
                        ? BSL.gold
                        : BSL.muted,
                    boxShadow: active ? `0 0 18px ${BSL.gold}66` : undefined,
                  }}
                  data-testid={`step-${s.key}`}
                >
                  {done ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Icon className="h-4 w-4" />
                  )}
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className="w-6 md:w-12 h-px mx-1"
                    style={{
                      background: done ? BSL.gold : "hsla(0,0%,100%,0.1)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        <GlowPanel title={STEPS[step].label} tone="gold">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step === 0 && (
                <div className="space-y-4">
                  <div>
                    <label
                      className="text-xs uppercase tracking-widest font-bold mb-2 block"
                      style={{ color: BSL.muted }}
                    >
                      Club Name
                    </label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Birmingham Phoenix BC"
                      className="w-full px-4 py-3 rounded-lg text-white placeholder-white/30 outline-none"
                      style={{
                        background: "hsla(0,0%,100%,0.05)",
                        border: `1px solid hsla(0,0%,100%,0.15)`,
                      }}
                      data-testid="input-club-name"
                    />
                  </div>
                </div>
              )}
              {step === 1 && (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: BSL.muted }}>
                    Optional. Upload your club crest. Square images work best.
                  </p>
                  <label className="block">
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(e) =>
                        e.target.files?.[0] && handleLogoFile(e.target.files[0])
                      }
                      data-testid="input-logo"
                    />
                    <div
                      className="h-44 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-[1.01]"
                      style={{
                        background: "hsla(0,0%,100%,0.04)",
                        border: `2px dashed hsla(0,0%,100%,0.2)`,
                      }}
                    >
                      {logoUrl ? (
                        <img
                          src={logoUrl}
                          alt="logo"
                          className="h-32 w-32 object-cover rounded-lg"
                        />
                      ) : (
                        <>
                          <Upload
                            className="h-8 w-8 mb-2"
                            style={{ color: BSL.cyan }}
                          />
                          <div className="text-sm" style={{ color: BSL.muted }}>
                            Click to upload logo
                          </div>
                        </>
                      )}
                    </div>
                  </label>
                </div>
              )}
              {step === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {(
                    league?.divisions || [
                      "Premier",
                      "Championship",
                      "Division 1",
                    ]
                  ).map((d: string) => (
                    <button
                      key={d}
                      onClick={() => setDivision(d)}
                      className="rounded-xl px-4 py-5 text-left transition-all"
                      style={{
                        background:
                          division === d
                            ? `${BSL.gold}22`
                            : "hsla(0,0%,100%,0.04)",
                        border: `1px solid ${division === d ? BSL.gold : "hsla(0,0%,100%,0.1)"}`,
                        boxShadow:
                          division === d ? `0 0 24px ${BSL.gold}44` : undefined,
                      }}
                      data-testid={`button-division-${d}`}
                    >
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.muted }}
                      >
                        Division
                      </div>
                      <div
                        className="text-lg font-black"
                        style={{ color: division === d ? BSL.gold : BSL.text }}
                      >
                        {d}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {step === 3 && (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: BSL.muted }}>
                    How many pairs will you enter in each category? Each pair
                    plays as its own team and gets a separate row in the
                    standings. Set 0 to skip a category.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      { key: "MD", label: "Men's Doubles", short: "MD" },
                      { key: "WD", label: "Women's Doubles", short: "WD" },
                      { key: "XD", label: "Mixed Doubles", short: "XD" },
                    ].map((c) => {
                      const value = categoryPairs[c.key] || 0;
                      const active = value > 0;
                      return (
                        <div
                          key={c.key}
                          className="rounded-xl px-4 py-5 transition-all"
                          style={{
                            background: active
                              ? `${BSL.gold}22`
                              : "hsla(0,0%,100%,0.04)",
                            border: `1px solid ${active ? BSL.gold : "hsla(0,0%,100%,0.1)"}`,
                            boxShadow: active
                              ? `0 0 24px ${BSL.gold}44`
                              : undefined,
                          }}
                          data-testid={`card-category-${c.key}`}
                        >
                          <div
                            className="text-[10px] uppercase tracking-widest"
                            style={{ color: BSL.muted }}
                          >
                            {c.short}
                          </div>
                          <div
                            className="text-base font-black mb-3"
                            style={{ color: active ? BSL.gold : BSL.text }}
                          >
                            {c.label}
                          </div>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => adjustPairs(c.key, -1)}
                              disabled={value === 0}
                              className="h-9 w-9 rounded-lg text-lg font-black disabled:opacity-30"
                              style={{
                                background: "hsla(0,0%,100%,0.06)",
                                border: "1px solid hsla(0,0%,100%,0.15)",
                              }}
                              data-testid={`button-pairs-minus-${c.key}`}
                            >
                              −
                            </button>
                            <div className="flex-1 text-center">
                              <div
                                className="text-3xl font-black"
                                style={{
                                  color: active ? BSL.gold : BSL.muted,
                                  textShadow: active
                                    ? `0 0 16px ${BSL.gold}66`
                                    : undefined,
                                }}
                                data-testid={`text-pairs-${c.key}`}
                              >
                                {value}
                              </div>
                              <div
                                className="text-[10px] uppercase tracking-widest"
                                style={{ color: BSL.muted }}
                              >
                                {value === 1 ? "Pair" : "Pairs"}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => adjustPairs(c.key, 1)}
                              disabled={value >= 8}
                              className="h-9 w-9 rounded-lg text-lg font-black disabled:opacity-30"
                              style={{
                                background: "hsla(0,0%,100%,0.06)",
                                border: "1px solid hsla(0,0%,100%,0.15)",
                              }}
                              data-testid={`button-pairs-plus-${c.key}`}
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div
                    className="text-xs text-center pt-1"
                    style={{ color: BSL.muted }}
                    data-testid="text-pairs-summary"
                  >
                    {totalPairs === 0
                      ? "Add at least one pair to continue"
                      : `${totalPairs} pair${totalPairs === 1 ? "" : "s"} registered · ${totalPairs} standings row${totalPairs === 1 ? "" : "s"} for your club`}
                  </div>
                </div>
              )}
              {step === 4 && createdClub && (
                <div className="space-y-4">
                  <div
                    className="rounded-xl p-4"
                    style={{
                      background: `${BSL.gold}10`,
                      border: `1px solid ${BSL.gold}55`,
                    }}
                  >
                    <div
                      className="text-[10px] uppercase tracking-widest font-bold mb-3"
                      style={{ color: BSL.gold }}
                    >
                      Bank Transfer Details
                    </div>
                    {[
                      ["Account Name", league?.bankAccountName],
                      ["Sort Code", league?.bankSortCode],
                      ["Account Number", league?.bankAccountNumber],
                      [
                        "Amount",
                        `£${((league?.clubFee || 0) / 100).toFixed(2)}`,
                      ],
                      ["Reference", createdClub.paymentReference],
                    ].map(([k, v]) => (
                      <div
                        key={k as string}
                        className="flex items-center justify-between py-2 border-b last:border-0"
                        style={{ borderColor: "hsla(0,0%,100%,0.05)" }}
                      >
                        <span
                          className="text-xs uppercase tracking-widest"
                          style={{ color: BSL.muted }}
                        >
                          {k}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-mono font-bold"
                            style={{ color: BSL.text }}
                            data-testid={`bank-${k}`}
                          >
                            {v}
                          </span>
                          <button
                            onClick={() =>
                              navigator.clipboard.writeText(String(v))
                            }
                            className="p-1 rounded hover:bg-white/10"
                          >
                            <Copy
                              className="h-3 w-3"
                              style={{ color: BSL.cyan }}
                            />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: BSL.muted }}>
                    ⚠️ Use the{" "}
                    <strong style={{ color: BSL.gold }}>exact reference</strong>{" "}
                    above so we can match your payment instantly.
                  </p>
                </div>
              )}
              {step === 5 && (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: BSL.muted }}>
                    Tell us about the transfer you just sent. The admin will
                    cross-check this against our bank statement and approve your
                    club.
                  </p>
                  <div className="space-y-3">
                    <label className="block">
                      <div
                        className="text-[10px] uppercase tracking-widest mb-1 font-bold"
                        style={{ color: BSL.muted }}
                      >
                        Amount paid (£)
                      </div>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={payAmount}
                        onChange={(e) => setPayAmount(e.target.value)}
                        placeholder="e.g. 250.00"
                        className="w-full px-3 py-2.5 rounded-lg text-base font-mono"
                        style={{
                          background: "hsla(0,0%,100%,0.05)",
                          border: `1px solid ${BSL.cyan}55`,
                          color: BSL.text,
                        }}
                        data-testid="input-pay-amount"
                      />
                    </label>
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
                        className="w-full px-3 py-2.5 rounded-lg text-base font-mono"
                        style={{
                          background: "hsla(0,0%,100%,0.05)",
                          border: `1px solid ${BSL.cyan}55`,
                          color: BSL.text,
                        }}
                        data-testid="input-pay-date"
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
                        className="w-full px-3 py-2.5 rounded-lg text-base"
                        style={{
                          background: "hsla(0,0%,100%,0.05)",
                          border: `1px solid ${BSL.cyan}55`,
                          color: BSL.text,
                        }}
                        data-testid="input-payer-name"
                      />
                    </label>
                  </div>
                </div>
              )}
              {step === 6 && createdClub && (
                <div className="text-center py-6 space-y-4">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className="h-20 w-20 rounded-full mx-auto flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, ${BSL.cyan}, ${BSL.cyanDim})`,
                      boxShadow: `0 0 48px ${BSL.cyan}88`,
                    }}
                  >
                    <Hourglass
                      className="h-10 w-10"
                      style={{ color: "hsl(222,50%,8%)" }}
                    />
                  </motion.div>
                  <div>
                    <div className="text-2xl font-black uppercase">
                      Pending Verification
                    </div>
                    <p className="text-sm mt-2" style={{ color: BSL.muted }}>
                      We'll verify your payment within 24 hours. Once approved
                      you'll receive your club invite code to share with
                      players.
                    </p>
                  </div>
                  <Link href="/">
                    <a>
                      <ActionButton
                        variant="cyan"
                        icon={<Sparkles className="h-4 w-4" />}
                      >
                        Back to League Mode
                      </ActionButton>
                    </a>
                  </Link>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Nav */}
          {step < 6 && (
            <div
              className="flex items-center justify-between pt-6 mt-6 border-t"
              style={{ borderColor: "hsla(0,0%,100%,0.08)" }}
            >
              <ActionButton
                variant="ghost"
                onClick={back}
                disabled={step === 0}
                icon={<ArrowLeft className="h-4 w-4" />}
              >
                Back
              </ActionButton>
              {step === 3 ? (
                <ActionButton
                  variant="gold"
                  onClick={() => createMutation.mutate()}
                  loading={createMutation.isPending}
                  disabled={!canProceed}
                  icon={<Banknote className="h-4 w-4" />}
                >
                  Get Bank Details
                </ActionButton>
              ) : step === 4 ? (
                <ActionButton
                  variant="gold"
                  onClick={next}
                  icon={<Check className="h-4 w-4" />}
                >
                  I Have Paid
                </ActionButton>
              ) : step === 5 ? (
                <ActionButton
                  variant="gold"
                  onClick={() => uploadProofMutation.mutate()}
                  loading={uploadProofMutation.isPending}
                  disabled={
                    !payAmount || !payDate || payerName.trim().length < 2
                  }
                  icon={<Receipt className="h-4 w-4" />}
                >
                  Submit Payment Details
                </ActionButton>
              ) : (
                <ActionButton
                  variant="gold"
                  onClick={next}
                  disabled={!canProceed}
                  icon={<ArrowRight className="h-4 w-4" />}
                >
                  Next
                </ActionButton>
              )}
            </div>
          )}
        </GlowPanel>
      </div>
    </div>
  );
}
