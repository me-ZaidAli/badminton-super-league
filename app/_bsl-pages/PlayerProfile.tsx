import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/routing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  User as UserIcon,
  Save,
  Wallet as WalletIcon,
  Check,
  Plus,
  X,
  Users,
  Trophy,
  CalendarClock,
  History,
  Shield,
  MapPin,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BslSubNav } from "@/components/BslSubNav";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["MD", "WD", "XD"] as const;
const CAT_LABEL: Record<string, string> = {
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

type Dashboard = {
  player: any;
  club: any | null;
  league: any | null;
  categories: {
    category: string;
    team: any | null;
    partners: {
      playerId: number;
      displayName: string;
      avatarUrl: string | null;
    }[];
  }[];
  nextMatch: any | null;
  upcoming: any[];
  history: any[];
  walletTx: any[];
};

// Strip leading status code prefix added by apiRequest ("402: …" → "…").
function cleanErr(e: any): string {
  const raw = e?.message || "Something went wrong";
  return raw.replace(/^\d{3}:\s*/, "");
}

export default function PlayerProfile() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const {
    data,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Dashboard>({
    queryKey: ["/api/bsl/players/me/dashboard"],
  });

  const me = data?.player;
  const club = data?.club || null;
  const league = data?.league || null;
  const cats = data?.categories || [];
  const upcoming = data?.upcoming || [];
  const history = data?.history || [];

  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (me) {
      setDisplayName(me.displayName || "");
      setBio(me.bio || "");
      setDirty(false);
    }
  }, [me?.id]);

  const invalidatePlayer = () => {
    qc.invalidateQueries({ queryKey: ["/api/bsl/players/me/dashboard"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/players/me"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/wallet/me"] });
  };

  const saveProfile = useMutation({
    mutationFn: async () => {
      return (
        await apiRequest("PATCH", "/api/bsl/players/me", { displayName, bio })
      ).json();
    },
    onSuccess: () => {
      invalidatePlayer();
      setDirty(false);
      toast({ title: "Profile saved" });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't save",
        description: cleanErr(e),
        variant: "destructive",
      }),
  });

  const registerCat = useMutation({
    mutationFn: async (category: string) =>
      (
        await apiRequest("POST", "/api/bsl/players/me/categories", { category })
      ).json(),
    onSuccess: (_d: any, cat: string) => {
      invalidatePlayer();
      toast({
        title: `Registered for ${CAT_LABEL[cat] || cat}`,
        description:
          "Wallet updated · pricing on the other categories has dropped.",
      });
    },
    // Friendly error — most common case is "Need £X.xx in your wallet — top up first."
    onError: (e: any) => toast({ title: "Heads up", description: cleanErr(e) }),
  });

  const payLeagueFee = useMutation({
    mutationFn: async () =>
      (
        await apiRequest(
          "POST",
          "/api/bsl/players/me/pay-league-fee-from-wallet",
          {},
        )
      ).json(),
    onSuccess: () => {
      invalidatePlayer();
      toast({
        title: "You're in!",
        description:
          "League fee paid from your wallet — you can now register for categories.",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't activate",
        description: cleanErr(e),
        variant: "destructive",
      }),
  });

  const unregisterCat = useMutation({
    mutationFn: async (category: string) =>
      (
        await apiRequest("DELETE", `/api/bsl/players/me/categories/${category}`)
      ).json(),
    onSuccess: () => {
      invalidatePlayer();
      toast({
        title: "Removed from category",
        description: "No automatic refund — admin will handle it.",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't remove",
        description: cleanErr(e),
        variant: "destructive",
      }),
  });

  if (isLoading) {
    return (
      <div
        className="min-h-screen text-white"
        style={{ background: BSL.bgDeep }}
      >
        <BSLBackground />
        <div
          className="max-w-4xl mx-auto px-4 py-12 text-center"
          style={{ color: BSL.muted }}
        >
          Loading…
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div
        className="min-h-screen text-white"
        style={{ background: BSL.bgDeep }}
      >
        <BSLBackground />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <BackBar />
          <GlowPanel
            title="Couldn't load profile"
            tone="cyan"
            icon={<UserIcon className="h-4 w-4" />}
          >
            <p className="text-sm mb-4" style={{ color: BSL.muted }}>
              {(error as Error)?.message || "Something went wrong."}
            </p>
            <ActionButton variant="cyan" onClick={() => refetch()}>
              Try again
            </ActionButton>
          </GlowPanel>
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <div
        className="min-h-screen text-white"
        style={{ background: BSL.bgDeep }}
      >
        <BSLBackground />
        <div className="max-w-2xl mx-auto px-4 py-12">
          <BackBar />
          <GlowPanel
            title="No BSL profile yet"
            tone="cyan"
            icon={<UserIcon className="h-4 w-4" />}
          >
            <p className="text-sm mb-4" style={{ color: BSL.muted }}>
              You haven't joined a BSL club yet.
            </p>
            <Link href="/join">
              <ActionButton variant="cyan">Join via invite code</ActionButton>
            </Link>
          </GlowPanel>
        </div>
      </div>
    );
  }

  const fees = (league?.categoryFees || {}) as Record<string, number>;
  const playerFee = league?.playerFee ?? 2500;
  const myCats: string[] = me.categories || [];
  const balance: number = me.walletBalance ?? 0;
  const winRate =
    me.matchesPlayed > 0
      ? Math.round((me.matchesWon / me.matchesPlayed) * 100)
      : 0;

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <BackBar />

        {/* HERO ─ club + status + headline stats */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden relative"
          style={{
            background: `linear-gradient(135deg, ${BSL.card} 0%, ${BSL.cardSoft} 100%)`,
            border: `1px solid ${BSL.border}`,
          }}
        >
          <div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background: `radial-gradient(120% 100% at 100% 0%, ${BSL.gold}33 0%, transparent 50%), radial-gradient(80% 80% at 0% 100%, ${BSL.cyan}22 0%, transparent 60%)`,
            }}
          />
          <div className="relative p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-5">
            <div
              className="h-20 w-20 md:h-24 md:w-24 rounded-2xl flex items-center justify-center text-2xl font-black overflow-hidden flex-shrink-0"
              style={{
                background: `${BSL.gold}22`,
                color: BSL.gold,
                border: `2px solid ${BSL.gold}66`,
              }}
            >
              {club?.logoUrl ? (
                <img
                  src={club.logoUrl}
                  alt={club.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                club?.name?.slice(0, 2) || "BSL"
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="text-[10px] uppercase tracking-widest"
                style={{ color: BSL.cyan }}
              >
                BSL Player
              </div>
              <h1 className="text-2xl md:text-3xl font-black uppercase tracking-tight truncate">
                {me.displayName || "Unnamed Player"}
              </h1>
              <div
                className="flex flex-wrap items-center gap-3 mt-1.5 text-xs"
                style={{ color: BSL.muted }}
              >
                {club && (
                  <span className="inline-flex items-center gap-1.5">
                    <Shield className="h-3 w-3" style={{ color: BSL.gold }} />
                    {club.name}
                  </span>
                )}
                {club?.division && (
                  <span className="inline-flex items-center gap-1.5">
                    · {club.division}
                  </span>
                )}
                <span className="inline-flex items-center gap-1.5">
                  ·
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest"
                    style={{
                      background:
                        me.status === "ACTIVE"
                          ? `${BSL.success}22`
                          : `${BSL.gold}22`,
                      color: me.status === "ACTIVE" ? BSL.success : BSL.gold,
                    }}
                    data-testid="text-player-status"
                  >
                    {me.status}
                  </span>
                </span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 md:gap-3 flex-shrink-0">
              <Stat label="Played" value={me.matchesPlayed ?? 0} tone="cyan" />
              <Stat label="Won" value={me.matchesWon ?? 0} tone="gold" />
              <Stat label="Win %" value={`${winRate}%`} tone="cyan" />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Wallet snapshot */}
          <GlowPanel
            title="Wallet"
            tone="gold"
            icon={<WalletIcon className="h-4 w-4" />}
          >
            <div className="text-center py-2">
              <div
                className="text-[10px] uppercase tracking-widest"
                style={{ color: BSL.muted }}
              >
                Balance
              </div>
              <div
                className="text-4xl font-black mt-1"
                style={{ color: BSL.gold }}
                data-testid="text-wallet-balance"
              >
                £{(balance / 100).toFixed(2)}
              </div>
            </div>
            <Link href="/wallet">
              <ActionButton variant="cyan" data-testid="button-go-wallet">
                Top up · transactions
              </ActionButton>
            </Link>
          </GlowPanel>

          {/* Next match */}
          <div className="lg:col-span-2">
            <GlowPanel
              title="Next match"
              tone="cyan"
              icon={<CalendarClock className="h-4 w-4" />}
            >
              {data?.nextMatch ? (
                <NextMatchCard m={data.nextMatch} />
              ) : league?.nextLeagueDay ? (
                <div className="py-4 text-center">
                  <div
                    className="text-xs uppercase tracking-widest"
                    style={{ color: BSL.muted }}
                  >
                    Next league day
                  </div>
                  <div
                    className="text-2xl font-black mt-1"
                    style={{ color: BSL.cyan }}
                  >
                    {fmtDate(league.nextLeagueDay)}
                  </div>
                  {league.venueName && (
                    <div
                      className="text-xs mt-1 inline-flex items-center gap-1.5"
                      style={{ color: BSL.muted }}
                    >
                      <MapPin className="h-3 w-3" /> {league.venueName}
                    </div>
                  )}
                  <div
                    className="text-[11px] mt-3"
                    style={{ color: BSL.muted }}
                  >
                    Your fixtures will appear here once the schedule is
                    published.
                  </div>
                </div>
              ) : (
                <div
                  className="py-4 text-center text-sm"
                  style={{ color: BSL.muted }}
                >
                  No upcoming matches yet. Sit tight — the next league day will
                  be announced soon.
                </div>
              )}
            </GlowPanel>
          </div>
        </div>

        {/* My pairs / partners ─ only render when at least one team exists */}
        {cats.some((c) => c.team) && (
          <GlowPanel
            title="My pairs"
            tone="gold"
            icon={<Users className="h-4 w-4" />}
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {cats
                .filter((c) => c.team)
                .map((c) => (
                  <div
                    key={c.category}
                    className="rounded-xl p-4"
                    style={{
                      background: BSL.cardSoft,
                      border: `1px solid ${BSL.border}`,
                    }}
                    data-testid={`card-pair-${c.category}`}
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.cyan }}
                      >
                        {c.category} · {CAT_LABEL[c.category]}
                      </div>
                      {c.team?.pairNumber && (
                        <div
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{
                            background: `${BSL.gold}22`,
                            color: BSL.gold,
                          }}
                        >
                          Pair #{c.team.pairNumber}
                        </div>
                      )}
                    </div>
                    <div className="text-sm font-bold mt-1">{c.team?.name}</div>
                    <div
                      className="mt-3 pt-3"
                      style={{ borderTop: `1px solid ${BSL.border}` }}
                    >
                      <div
                        className="text-[10px] uppercase tracking-widest mb-1.5"
                        style={{ color: BSL.muted }}
                      >
                        Partner{c.partners.length > 1 ? "s" : ""}
                      </div>
                      {c.partners.length === 0 ? (
                        <div
                          className="text-xs italic"
                          style={{ color: BSL.muted }}
                        >
                          Awaiting club owner to pair you
                        </div>
                      ) : (
                        <div className="space-y-1.5">
                          {c.partners.map((p) => (
                            <div
                              key={p.playerId}
                              className="flex items-center gap-2"
                            >
                              <div
                                className="h-7 w-7 rounded-full overflow-hidden flex items-center justify-center text-[10px] font-bold"
                                style={{
                                  background: `${BSL.cyan}22`,
                                  color: BSL.cyan,
                                }}
                              >
                                {p.avatarUrl ? (
                                  <img
                                    src={p.avatarUrl}
                                    alt=""
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  p.displayName?.[0] || "?"
                                )}
                              </div>
                              <span
                                className="text-sm font-semibold truncate"
                                data-testid={`text-partner-${p.playerId}`}
                              >
                                {p.displayName}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </GlowPanel>
        )}

        {/* Profile editor */}
        <GlowPanel
          title="Display name & bio"
          tone="cyan"
          icon={<UserIcon className="h-4 w-4" />}
        >
          <Field label="Display name (shown on the leaderboard)">
            <input
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setDirty(true);
              }}
              maxLength={80}
              placeholder="e.g. The Smasher"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-display-name"
            />
          </Field>
          <Field label="Bio">
            <textarea
              value={bio}
              onChange={(e) => {
                setBio(e.target.value);
                setDirty(true);
              }}
              maxLength={600}
              rows={3}
              placeholder="Tell other players about yourself…"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-bio"
            />
          </Field>
          <div className="text-right mt-2">
            <ActionButton
              variant="gold"
              onClick={() => saveProfile.mutate()}
              disabled={!dirty || saveProfile.isPending}
              icon={<Save className="h-3 w-3" />}
              data-testid="button-save-profile"
            >
              {saveProfile.isPending ? "Saving…" : "Save profile"}
            </ActionButton>
          </div>
        </GlowPanel>

        {/* Category registration */}
        <GlowPanel
          title="Compete in categories"
          tone="gold"
          icon={<Plus className="h-4 w-4" />}
        >
          {me.status !== "ACTIVE" &&
            (() => {
              // PENDING_VERIFICATION ALWAYS shows the wait message — never the pay-from-wallet
              // CTA — to avoid double payment when bank-transfer proof is already in the queue.
              const canPayFromWallet =
                balance >= playerFee && me.status === "PENDING_PAYMENT";
              return (
                <div
                  className="mb-3 rounded-lg px-3 py-2.5 text-xs"
                  style={{
                    background: `${BSL.gold}15`,
                    border: `1px solid ${BSL.gold}55`,
                    color: BSL.gold,
                  }}
                  data-testid="banner-pending-approval"
                >
                  <div className="font-bold uppercase tracking-widest text-[10px] mb-0.5">
                    {canPayFromWallet
                      ? "One more step to activate"
                      : me.status === "PENDING_VERIFICATION"
                        ? "Awaiting admin verification"
                        : "League fee not paid yet"}
                  </div>
                  <div className="text-white/80 text-[11px] leading-snug">
                    {canPayFromWallet ? (
                      <>
                        You have £{(balance / 100).toFixed(2)} in your wallet.
                        Pay the £{(playerFee / 100).toFixed(2)} league fee to
                        unlock category registration immediately — no waiting on
                        an admin.
                      </>
                    ) : me.status === "PENDING_VERIFICATION" ? (
                      <>
                        Your league fee payment proof is in the admin queue.
                        Once verified you'll be activated and can register for
                        categories.
                      </>
                    ) : (
                      <>
                        Top up your wallet to at least £
                        {(playerFee / 100).toFixed(2)}, then pay the league fee
                        from there to activate instantly. Or upload
                        bank-transfer proof from the join flow.
                      </>
                    )}
                  </div>
                  {canPayFromWallet && (
                    <div className="mt-2.5">
                      <ActionButton
                        variant="gold"
                        onClick={() => payLeagueFee.mutate()}
                        disabled={payLeagueFee.isPending}
                        icon={<Check className="h-3 w-3" />}
                        data-testid="button-pay-league-fee-from-wallet"
                      >
                        {payLeagueFee.isPending
                          ? "Activating…"
                          : `Pay £${(playerFee / 100).toFixed(2)} & activate`}
                      </ActionButton>
                    </div>
                  )}
                  {!canPayFromWallet &&
                    me.status !== "PENDING_VERIFICATION" &&
                    me.status !== "REJECTED" && (
                      <div className="mt-2.5">
                        <Link href="/wallet">
                          <ActionButton
                            variant="cyan"
                            icon={<WalletIcon className="h-3 w-3" />}
                            data-testid="button-go-topup"
                          >
                            Top up wallet
                          </ActionButton>
                        </Link>
                      </div>
                    )}
                </div>
              );
            })()}
          <p className="text-xs mb-1" style={{ color: BSL.muted }}>
            Each category has its own fee — debited from your BSL wallet on
            registration. Your club owner places you in a pair after you
            register.
          </p>
          <div
            className="text-[11px] mb-4 flex flex-wrap gap-x-3 gap-y-1"
            style={{ color: BSL.cyan }}
          >
            <span>Multi-category loyalty:</span>
            <span>
              <span style={{ color: BSL.gold }}>1st</span> full price
            </span>
            <span>
              <span style={{ color: BSL.gold }}>2nd</span> 50% off
            </span>
            <span>
              <span style={{ color: BSL.gold }}>3rd</span> 70% off
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {CATEGORIES.map((cat) => {
              const baseFee = Number.isFinite(fees[cat])
                ? fees[cat]
                : playerFee;
              const registered = myCats.includes(cat);
              // Discount tier mirrors the server's SQL CASE — based on how many
              // cats the player will already have at the moment they register.
              const tierCount = myCats.length;
              const discountedFee =
                tierCount === 0
                  ? baseFee
                  : tierCount === 1
                    ? Math.floor((baseFee * 50) / 100)
                    : Math.floor((baseFee * 30) / 100);
              const fee = registered ? baseFee : discountedFee;
              const discountPct =
                !registered && tierCount > 0 ? (tierCount === 1 ? 50 : 70) : 0;
              const canAfford = balance >= fee;
              return (
                <motion.div
                  key={cat}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl p-4 relative overflow-hidden"
                  style={{
                    background: registered ? `${BSL.gold}15` : BSL.cardSoft,
                    border: `1px solid ${registered ? BSL.gold : BSL.border}`,
                  }}
                  data-testid={`card-category-${cat}`}
                >
                  {registered && (
                    <div
                      className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
                      style={{ background: BSL.gold, color: "#1a1300" }}
                    >
                      <Check className="h-3 w-3" /> Active
                    </div>
                  )}
                  <div
                    className="text-xs uppercase tracking-widest"
                    style={{ color: BSL.cyan }}
                  >
                    {cat}
                  </div>
                  <div className="text-sm font-bold mt-0.5">
                    {CAT_LABEL[cat]}
                  </div>
                  <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                    <div
                      className="text-2xl font-black"
                      style={{ color: registered ? BSL.gold : "white" }}
                      data-testid={`text-fee-${cat}`}
                    >
                      £{(fee / 100).toFixed(2)}
                    </div>
                    {discountPct > 0 && (
                      <>
                        <div
                          className="text-xs line-through"
                          style={{ color: BSL.muted }}
                        >
                          £{(baseFee / 100).toFixed(2)}
                        </div>
                        <div
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: `${BSL.cyan}22`,
                            color: BSL.cyan,
                          }}
                        >
                          −{discountPct}%
                        </div>
                      </>
                    )}
                  </div>
                  <div
                    className="text-[10px] mb-3"
                    style={{ color: BSL.muted }}
                  >
                    one-off, per season
                    {discountPct > 0 ? " · multi-cat discount applied" : ""}
                  </div>
                  {registered ? (
                    <ActionButton
                      variant="ghost"
                      onClick={() => unregisterCat.mutate(cat)}
                      disabled={unregisterCat.isPending}
                      icon={<X className="h-3 w-3" />}
                      data-testid={`button-unregister-${cat}`}
                    >
                      Unregister
                    </ActionButton>
                  ) : (
                    <ActionButton
                      variant="gold"
                      onClick={() => registerCat.mutate(cat)}
                      disabled={
                        registerCat.isPending ||
                        !canAfford ||
                        me.status !== "ACTIVE"
                      }
                      icon={<Plus className="h-3 w-3" />}
                      data-testid={`button-register-${cat}`}
                    >
                      {me.status !== "ACTIVE"
                        ? "Pay league fee first"
                        : !canAfford
                          ? "Top up first"
                          : "Register"}
                    </ActionButton>
                  )}
                </motion.div>
              );
            })}
          </div>
        </GlowPanel>

        {/* Match history */}
        <GlowPanel
          title="Match history"
          tone="cyan"
          icon={<History className="h-4 w-4" />}
        >
          {history.length === 0 ? (
            <div
              className="py-6 text-center text-sm"
              style={{ color: BSL.muted }}
            >
              No completed matches yet. Once results are submitted they'll show
              up here.
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((m) => (
                <HistoryRow key={m.id} m={m} />
              ))}
            </div>
          )}
        </GlowPanel>

        {/* Upcoming list (only when more than just the highlighted next match) */}
        {upcoming.length > 1 && (
          <GlowPanel
            title="Other upcoming fixtures"
            tone="gold"
            icon={<Trophy className="h-4 w-4" />}
          >
            <div className="space-y-2">
              {upcoming.slice(1).map((m) => (
                <UpcomingRow key={m.id} m={m} />
              ))}
            </div>
          </GlowPanel>
        )}
      </div>
    </div>
  );
}

function NextMatchCard({ m }: { m: any }) {
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: BSL.cardSoft, border: `1px solid ${BSL.cyan}55` }}
      data-testid={`card-next-match-${m.id}`}
    >
      <div
        className="flex items-center justify-between text-[10px] uppercase tracking-widest"
        style={{ color: BSL.muted }}
      >
        <span>{m.startTime ? fmtDate(m.startTime) : "TBC"}</span>
        {m.court != null && (
          <span style={{ color: BSL.cyan }}>Court {m.court}</span>
        )}
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamFace team={m.us} align="right" highlight />
        <div
          className="text-xs font-black uppercase tracking-widest"
          style={{ color: BSL.gold }}
        >
          VS
        </div>
        <TeamFace team={m.them} align="left" />
      </div>
      <div
        className="mt-3 text-center text-[11px]"
        style={{ color: BSL.muted }}
      >
        Status: <span style={{ color: BSL.cyan }}>{m.status}</span>
      </div>
    </div>
  );
}

function TeamFace({
  team,
  align,
  highlight,
}: {
  team: any;
  align: "left" | "right";
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${align === "right" ? "justify-end" : "justify-start"}`}
    >
      {align === "left" && (
        <Logo url={team.logoUrl} name={team.name} highlight={highlight} />
      )}
      <div className={align === "right" ? "text-right" : "text-left"}>
        <div
          className="text-sm font-black truncate"
          style={{ color: highlight ? BSL.gold : "white" }}
        >
          {team.name}
        </div>
      </div>
      {align === "right" && (
        <Logo url={team.logoUrl} name={team.name} highlight={highlight} />
      )}
    </div>
  );
}

function Logo({
  url,
  name,
  highlight,
}: {
  url: string | null;
  name: string;
  highlight?: boolean;
}) {
  return (
    <div
      className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center text-xs font-black flex-shrink-0"
      style={{
        background: highlight ? `${BSL.gold}22` : `${BSL.cyan}22`,
        color: highlight ? BSL.gold : BSL.cyan,
        border: `1px solid ${highlight ? BSL.gold : BSL.border}`,
      }}
    >
      {url ? (
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        name?.slice(0, 2) || "?"
      )}
    </div>
  );
}

function HistoryRow({ m }: { m: any }) {
  const tone =
    m.outcome === "WIN"
      ? BSL.success
      : m.outcome === "LOSS"
        ? BSL.danger
        : BSL.muted;
  return (
    <div
      className="rounded-lg p-3 flex items-center gap-3"
      style={{ background: BSL.cardSoft, border: `1px solid ${BSL.border}` }}
      data-testid={`row-history-${m.id}`}
    >
      <div
        className="text-[10px] uppercase tracking-widest font-black w-12 text-center"
        style={{ color: tone }}
      >
        {m.outcome || "—"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">
          {m.us.name} <span style={{ color: BSL.muted }}>vs</span> {m.them.name}
        </div>
        <div className="text-[10px]" style={{ color: BSL.muted }}>
          {m.startTime ? fmtDate(m.startTime) : "Date TBC"}
        </div>
      </div>
      <div className="text-lg font-black tabular-nums" style={{ color: tone }}>
        {m.us.rubbers}
        <span style={{ color: BSL.muted }}> – </span>
        {m.them.rubbers}
      </div>
    </div>
  );
}

function UpcomingRow({ m }: { m: any }) {
  return (
    <div
      className="rounded-lg p-3 flex items-center gap-3"
      style={{ background: BSL.cardSoft, border: `1px solid ${BSL.border}` }}
      data-testid={`row-upcoming-${m.id}`}
    >
      <CalendarClock
        className="h-4 w-4 flex-shrink-0"
        style={{ color: BSL.cyan }}
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-bold truncate">
          {m.us.name} <span style={{ color: BSL.muted }}>vs</span> {m.them.name}
        </div>
        <div className="text-[10px]" style={{ color: BSL.muted }}>
          {m.startTime ? fmtDate(m.startTime) : "Date TBC"}
          {m.court != null ? ` · Court ${m.court}` : ""}
        </div>
      </div>
      <span
        className="text-[10px] uppercase tracking-widest font-black"
        style={{ color: BSL.gold }}
      >
        {m.status}
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number | string;
  tone: "gold" | "cyan";
}) {
  const c = tone === "gold" ? BSL.gold : BSL.cyan;
  return (
    <div
      className="rounded-lg px-3 py-2 text-center min-w-[70px]"
      style={{ background: `${c}15`, border: `1px solid ${c}44` }}
    >
      <div
        className="text-[9px] uppercase tracking-widest"
        style={{ color: BSL.muted }}
      >
        {label}
      </div>
      <div className="text-lg font-black tabular-nums" style={{ color: c }}>
        {value}
      </div>
    </div>
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
    <label className="block mb-3">
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

function fmtDate(v: string | Date): string {
  const d = v instanceof Date ? v : new Date(v);
  if (isNaN(d.getTime())) return "TBC";
  return d.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}
