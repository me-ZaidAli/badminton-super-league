import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/routing";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Crown,
  Medal,
  Sparkles,
  Lock,
  Gem,
  Star,
  Zap,
  ChevronLeft,
  Settings2,
  Share2,
  TrendingUp,
  Users,
  RotateCcw,
  Info,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BSL } from "@/components/bsl/BSLPalette";
import { ActionButton } from "@/components/bsl/ActionButton";
import { ShareInviteDialog } from "@/components/bsl/ShareInviteDialog";
import { BslSubNav } from "@/components/BslSubNav";
import { useUser } from "@/hooks/use-auth";

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

const CATEGORY_LABEL: Record<string, string> = {
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
  MS1: "Men's Singles 1",
  MS2: "Men's Singles 2",
  WS: "Women's Singles",
};

// Tier definitions — locked to BSL palette family but with rich gradient surfaces.
const TIER: Record<
  string,
  {
    from: string;
    to: string;
    ring: string;
    glow: string;
    chip: string;
    label: string;
    icon: any;
  }
> = {
  DIAMOND: {
    from: "hsl(195,100%,72%)",
    to: "hsl(210,90%,52%)",
    ring: "hsl(195,100%,80%)",
    glow: "hsla(195,100%,60%,0.55)",
    chip: "hsl(195,100%,90%)",
    label: "DIAMOND",
    icon: Gem,
  },
  PLATINUM: {
    from: "hsl(210,30%,88%)",
    to: "hsl(220,30%,55%)",
    ring: "hsl(210,40%,90%)",
    glow: "hsla(210,40%,80%,0.45)",
    chip: "hsl(210,30%,95%)",
    label: "PLATINUM",
    icon: Sparkles,
  },
  GOLD: {
    from: "hsl(48,100%,68%)",
    to: "hsl(36,90%,42%)",
    ring: "hsl(48,100%,75%)",
    glow: "hsla(42,95%,55%,0.55)",
    chip: "hsl(48,100%,90%)",
    label: "GOLD",
    icon: Crown,
  },
  SILVER: {
    from: "hsl(220,15%,82%)",
    to: "hsl(220,15%,55%)",
    ring: "hsl(220,15%,86%)",
    glow: "hsla(220,15%,75%,0.45)",
    chip: "hsl(220,15%,92%)",
    label: "SILVER",
    icon: Medal,
  },
  BRONZE: {
    from: "hsl(28,80%,62%)",
    to: "hsl(20,75%,38%)",
    ring: "hsl(28,80%,70%)",
    glow: "hsla(28,80%,55%,0.45)",
    chip: "hsl(28,80%,88%)",
    label: "BRONZE",
    icon: Medal,
  },
  MYTHIC: {
    from: "hsl(280,90%,70%)",
    to: "hsl(320,80%,45%)",
    ring: "hsl(290,90%,75%)",
    glow: "hsla(290,90%,65%,0.55)",
    chip: "hsl(290,80%,92%)",
    label: "MYTHIC",
    icon: Star,
  },
  EPIC: {
    from: "hsl(160,80%,55%)",
    to: "hsl(180,90%,40%)",
    ring: "hsl(170,90%,65%)",
    glow: "hsla(170,90%,55%,0.50)",
    chip: "hsl(170,80%,90%)",
    label: "EPIC",
    icon: Zap,
  },
};

function tierOf(t: string) {
  return TIER[t?.toUpperCase()] || TIER.GOLD;
}
function moneyGBP(p: number | null) {
  return p == null
    ? null
    : `£${(p / 100).toLocaleString("en-GB", { maximumFractionDigits: 0 })}`;
}

export default function BslPrizes() {
  const { data: user } = useUser();
  const isAdmin =
    (user as any)?.role === "OWNER" || (user as any)?.role === "ADMIN";
  const { data: prizes = [], isLoading } = useQuery<Prize[]>({
    queryKey: ["/api/bsl/prizes"],
  });
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const { data: clubs = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/clubs"],
  });
  const [shareOpen, setShareOpen] = useState(false);
  const activeClubs = clubs.filter((c: any) => c.status === "ACTIVE").length;

  // Group by division → category
  const grouped = useMemo(() => {
    const byDiv = new Map<string, Map<string, Prize[]>>();
    for (const p of prizes) {
      const d = p.division || "Overall";
      const c = p.category || "OPEN";
      if (!byDiv.has(d)) byDiv.set(d, new Map());
      const dm = byDiv.get(d)!;
      if (!dm.has(c)) dm.set(c, []);
      dm.get(c)!.push(p);
    }
    // Sort categories' prizes by rank, sortOrder
    for (const dm of byDiv.values()) {
      for (const arr of dm.values())
        arr.sort((a, b) => a.rank - b.rank || a.sortOrder - b.sortOrder);
    }
    return byDiv;
  }, [prizes]);

  // Compute totals for hero
  const totals = useMemo(() => {
    const total = prizes.reduce((s, p) => s + (p.prizeAmountPence || 0), 0);
    return { total, count: prizes.length, divisions: grouped.size };
  }, [prizes, grouped]);

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />
      <ShareInviteDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        title="Grow the BSL Prize Pool"
        subtitle="Every new club that joins makes the year-end prize vault bigger. Share this link to invite clubs and groups."
        shareUrl={
          typeof window !== "undefined" ? `${window.location.origin}/bsl` : ""
        }
        filenameSlug="bsl-prize-pool"
      />

      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-6">
        <Link href="/">
          <a
            className="inline-flex items-center gap-1.5 text-xs uppercase tracking-[0.18em] mb-5"
            style={{ color: BSL.muted }}
            data-testid="link-back"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Back to BSL
          </a>
        </Link>

        {/* === HERO === */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative overflow-hidden rounded-3xl p-6 md:p-10"
          style={{
            background: `
              radial-gradient(80% 60% at 80% 0%, hsla(42,95%,55%,0.28), transparent 60%),
              radial-gradient(70% 60% at 0% 100%, hsla(195,100%,60%,0.22), transparent 60%),
              linear-gradient(140deg, hsla(222,55%,12%,0.95), hsla(222,75%,5%,0.98))`,
            border: `1px solid ${BSL.gold}55`,
            boxShadow: `0 32px 80px hsla(222,80%,2%,0.6), inset 0 1px 0 hsla(0,0%,100%,0.06)`,
          }}
          data-testid="hero-prizes"
        >
          {/* Floating rotating trophy */}
          <motion.div
            className="absolute -top-12 -right-12 md:-top-20 md:-right-20 pointer-events-none"
            animate={{ y: [0, -10, 0], rotate: [-4, 4, -4] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          >
            <div
              className="rounded-full"
              style={{
                width: 360,
                height: 360,
                background: `radial-gradient(circle at 30% 30%, ${BSL.gold}, transparent 60%)`,
                filter: "blur(20px)",
                opacity: 0.45,
              }}
            />
          </motion.div>
          <motion.div
            initial={{ scale: 0.6, opacity: 0, rotate: -20 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            transition={{ delay: 0.3, duration: 0.9, type: "spring" }}
            className="absolute top-4 right-4 md:top-8 md:right-10 hidden sm:block pointer-events-none"
          >
            <Trophy
              className="h-24 md:h-44 w-24 md:w-44"
              style={{
                color: BSL.gold,
                filter: `drop-shadow(0 0 32px ${BSL.gold}) drop-shadow(0 0 64px hsla(42,95%,55%,0.45))`,
              }}
            />
          </motion.div>

          <div className="relative max-w-2xl">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] md:text-xs font-bold uppercase tracking-[0.32em] px-2.5 py-1 rounded-full"
              style={{
                background: `${BSL.gold}22`,
                color: BSL.gold,
                border: `1px solid ${BSL.gold}55`,
              }}
            >
              <Sparkles className="h-3 w-3" /> Season {league?.name ? "·" : ""}{" "}
              {league?.name || "Birmingham Super League"}
            </span>
            <h1 className="mt-3 text-4xl md:text-6xl font-black uppercase leading-[0.95] tracking-tight">
              YEAR-END
              <span
                className="block"
                style={{
                  background: `linear-gradient(90deg, ${BSL.gold}, ${BSL.cyan})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                }}
              >
                PRIZE VAULT
              </span>
            </h1>
            <p
              className="mt-3 text-sm md:text-base max-w-xl"
              style={{ color: BSL.muted }}
            >
              Battle through the season — every division and every category has
              its own glowing tier of rewards waiting at the finish line.
            </p>

            {/* Growth callout — more clubs = bigger prizes */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
              className="mt-5 rounded-2xl p-4 md:p-5 max-w-xl"
              style={{
                background: `linear-gradient(135deg, hsla(195,100%,60%,0.14), hsla(42,95%,55%,0.18))`,
                border: `1px solid ${BSL.gold}66`,
                boxShadow: `0 0 32px hsla(42,95%,55%,0.18), inset 0 1px 0 hsla(0,0%,100%,0.08)`,
              }}
              data-testid="callout-grow-pool"
            >
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 h-10 w-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: `${BSL.gold}33`,
                    border: `1px solid ${BSL.gold}66`,
                  }}
                >
                  <TrendingUp className="h-5 w-5" style={{ color: BSL.gold }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[10px] font-black uppercase tracking-[0.28em] mb-1"
                    style={{ color: BSL.gold }}
                  >
                    Prizes scale with the league
                  </div>
                  <p
                    className="text-sm leading-snug"
                    style={{ color: "white" }}
                  >
                    The more clubs and groups that sign up, the{" "}
                    <strong style={{ color: BSL.gold }}>
                      bigger every prize gets
                    </strong>
                    . Currently{" "}
                    <strong style={{ color: BSL.cyan }}>
                      {activeClubs}{" "}
                      {activeClubs === 1 ? "club is" : "clubs are"}
                    </strong>{" "}
                    in — invite more to grow the vault.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => setShareOpen(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                      style={{
                        background: BSL.gold,
                        color: "hsl(222,50%,8%)",
                        boxShadow: `0 6px 20px ${BSL.gold}55`,
                      }}
                      data-testid="button-invite-clubs"
                    >
                      <Share2 className="h-3.5 w-3.5" /> Invite clubs & groups
                    </button>
                    <Link href="/register-club">
                      <a
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider"
                        style={{
                          background: "hsla(0,0%,100%,0.08)",
                          color: "white",
                          border: `1px solid ${BSL.cyan}55`,
                        }}
                        data-testid="link-register-club"
                      >
                        <Users className="h-3.5 w-3.5" /> Register a club
                      </a>
                    </Link>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Stat strip */}
            <div className="mt-6 grid grid-cols-4 gap-2 md:gap-3 max-w-2xl">
              {[
                {
                  v: totals.total ? moneyGBP(totals.total) : "—",
                  l: "Prize Pool",
                  c: BSL.gold,
                },
                { v: activeClubs || "—", l: "Clubs In", c: BSL.cyan },
                { v: totals.divisions || "—", l: "Divisions", c: BSL.cyan },
                { v: totals.count || "—", l: "Reward Tiers", c: BSL.gold },
              ].map((s, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  className="rounded-xl px-3 py-2.5 backdrop-blur-md"
                  style={{
                    background: `linear-gradient(140deg, hsla(0,0%,100%,0.06), hsla(0,0%,100%,0.02))`,
                    border: `1px solid hsla(0,0%,100%,0.10)`,
                  }}
                >
                  <div
                    className="text-xl md:text-2xl font-black tabular-nums"
                    style={{ color: s.c }}
                  >
                    {s.v}
                  </div>
                  <div
                    className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold"
                    style={{ color: BSL.muted }}
                  >
                    {s.l}
                  </div>
                </motion.div>
              ))}
            </div>

            {isAdmin && (
              <div className="mt-6">
                <Link href="/admin/prizes">
                  <ActionButton
                    variant="cyan"
                    icon={<Settings2 className="h-4 w-4" />}
                  >
                    Manage prizes
                  </ActionButton>
                </Link>
              </div>
            )}
          </div>
        </motion.div>

        {/* === DIVISIONS === */}
        {isLoading ? (
          <div
            className="mt-10 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            Loading prize vault…
          </div>
        ) : grouped.size === 0 ? (
          <EmptyState isAdmin={isAdmin} />
        ) : (
          <div className="mt-10 space-y-12">
            {[...grouped.entries()].map(([division, cats], di) => (
              <DivisionSection
                key={division}
                division={division}
                cats={cats}
                index={di}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DivisionSection({
  division,
  cats,
  index,
}: {
  division: string;
  cats: Map<string, Prize[]>;
  index: number;
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay: index * 0.05 }}
      data-testid={`section-division-${division.toLowerCase().replace(/\s+/g, "-")}`}
    >
      {/* Division banner */}
      <div
        className="relative mb-5 overflow-hidden rounded-2xl px-5 py-4 md:px-7 md:py-5"
        style={{
          background: `linear-gradient(90deg, hsla(195,100%,60%,0.18), hsla(42,95%,55%,0.12))`,
          border: `1px solid hsla(195,100%,60%,0.30)`,
        }}
      >
        <div
          className="absolute inset-y-0 left-0 w-1.5"
          style={{
            background: `linear-gradient(180deg, ${BSL.cyan}, ${BSL.gold})`,
          }}
        />
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div
              className="text-[10px] md:text-xs font-bold uppercase tracking-[0.32em]"
              style={{ color: BSL.cyan }}
            >
              Division
            </div>
            <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight">
              {division}
            </h2>
          </div>
          <div
            className="text-[10px] md:text-xs font-bold uppercase tracking-[0.18em] px-3 py-1.5 rounded-full"
            style={{
              background: `${BSL.gold}1a`,
              color: BSL.gold,
              border: `1px solid ${BSL.gold}55`,
            }}
          >
            {cats.size} {cats.size === 1 ? "category" : "categories"}
          </div>
        </div>
      </div>

      {/* Per-category groups */}
      <div className="space-y-8">
        {[...cats.entries()].map(([cat, prizes], ci) => (
          <CategoryGroup key={cat} cat={cat} prizes={prizes} index={ci} />
        ))}
      </div>
    </motion.section>
  );
}

function CategoryGroup({
  cat,
  prizes,
  index,
}: {
  cat: string;
  prizes: Prize[];
  index: number;
}) {
  const label = CATEGORY_LABEL[cat] || cat;
  return (
    <div data-testid={`group-category-${cat.toLowerCase()}`}>
      <div className="flex items-baseline justify-between mb-3 px-1">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center h-7 w-7 rounded-md text-[10px] font-black"
            style={{
              background: `${BSL.gold}22`,
              color: BSL.gold,
              border: `1px solid ${BSL.gold}55`,
            }}
          >
            {cat}
          </span>
          <h3 className="text-lg md:text-xl font-bold uppercase tracking-wider">
            {label}
          </h3>
        </div>
        <span
          className="text-[10px] uppercase tracking-[0.2em]"
          style={{ color: BSL.muted }}
        >
          {prizes.length} {prizes.length === 1 ? "tier" : "tiers"}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
        {prizes.map((p, i) => (
          <PrizeCard key={p.id} p={p} index={i} delay={index * 0.04} />
        ))}
      </div>
    </div>
  );
}

type Spark = {
  id: number;
  angle: number;
  distance: number;
  size: number;
  color: string;
};

function PrizeCard({
  p,
  index,
  delay,
}: {
  p: Prize;
  index: number;
  delay: number;
}) {
  const t = tierOf(p.tier);
  const Icon = t.icon;
  const isFirst = p.rank === 1;
  const [flipped, setFlipped] = useState(false);
  const [sparks, setSparks] = useState<Spark[]>([]);

  const burstSparks = () => {
    const palette = [t.from, t.to, t.chip, t.ring, "white"];
    const next: Spark[] = Array.from({ length: 22 }).map((_, i) => ({
      id: Date.now() + i,
      angle: (Math.PI * 2 * i) / 22 + Math.random() * 0.4,
      distance: 80 + Math.random() * 90,
      size: 4 + Math.random() * 6,
      color: palette[Math.floor(Math.random() * palette.length)],
    }));
    setSparks((s) => [...s, ...next]);
    window.setTimeout(() => {
      setSparks((s) => s.filter((sp) => !next.find((n) => n.id === sp.id)));
    }, 1100);
  };

  const handleClick = () => {
    burstSparks();
    setFlipped((f) => !f);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.55,
        delay: delay + index * 0.07,
        ease: [0.16, 1, 0.3, 1],
      }}
      whileHover={{ y: -6, scale: 1.02 }}
      className="group relative cursor-pointer select-none"
      style={{ perspective: 1200, minHeight: 460 }}
      onClick={handleClick}
      role="button"
      aria-pressed={flipped}
      data-testid={`prize-card-${p.id}`}
    >
      {/* Spark burst layer */}
      <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-visible">
        <AnimatePresence>
          {sparks.map((sp) => (
            <motion.div
              key={sp.id}
              initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
              animate={{
                x: Math.cos(sp.angle) * sp.distance,
                y: Math.sin(sp.angle) * sp.distance,
                opacity: 0,
                scale: 0.2,
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.9 + Math.random() * 0.3,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="absolute rounded-full"
              style={{
                width: sp.size,
                height: sp.size,
                background: sp.color,
                boxShadow: `0 0 ${sp.size * 2}px ${sp.color}, 0 0 ${sp.size * 4}px ${sp.color}55`,
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Flip container */}
      <motion.div
        className="relative w-full h-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* ===== FRONT ===== */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: `linear-gradient(180deg, hsla(222,40%,14%,0.92), hsla(222,60%,6%,0.96))`,
            border: `1px solid ${t.ring}55`,
            boxShadow: `0 24px 60px -16px ${t.glow}, inset 0 1px 0 hsla(0,0%,100%,0.05)`,
          }}
        >
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${t.ring}, transparent)`,
            }}
          />
          <motion.div
            className="pointer-events-none absolute -top-16 -right-16 h-56 w-56 rounded-full blur-3xl opacity-50 group-hover:opacity-80 transition-opacity duration-500"
            style={{
              background: `radial-gradient(circle, ${t.from}, transparent 70%)`,
            }}
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Top chips */}
          <div className="relative flex items-start justify-between p-4">
            <span
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
              style={{
                background: "hsla(0,0%,0%,0.45)",
                color: "white",
                border: "1px solid hsla(0,0%,100%,0.10)",
              }}
            >
              {isFirst && (
                <Crown className="h-3 w-3" style={{ color: BSL.gold }} />
              )}{" "}
              #{p.rank}
            </span>
            <span
              className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
              style={{
                background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                color: "hsl(222,50%,8%)",
              }}
            >
              <Icon className="h-3 w-3" /> {t.label}
            </span>
          </div>

          {/* Hero shield */}
          <div className="relative flex items-center justify-center py-4">
            <motion.div
              className="relative flex items-center justify-center"
              animate={{
                y: [0, -4, 0],
                rotate: isFirst ? [0, -2, 2, -2, 0] : 0,
              }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Spinning conic ring */}
              <motion.div
                className="absolute"
                style={{
                  width: 152,
                  height: 152,
                  background: `conic-gradient(from 0deg, ${t.from}, transparent 30%, ${t.to}, transparent 70%, ${t.from})`,
                  filter: "blur(14px)",
                  opacity: 0.65,
                  borderRadius: "50%",
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              />
              <div
                className="relative flex items-center justify-center"
                style={{
                  width: 132,
                  height: 132,
                  background: `linear-gradient(160deg, ${t.from}, ${t.to})`,
                  clipPath:
                    "polygon(50% 0%, 100% 18%, 100% 65%, 50% 100%, 0% 65%, 0% 18%)",
                  boxShadow: `inset 0 2px 0 hsla(0,0%,100%,0.35), inset 0 -8px 24px hsla(0,0%,0%,0.35)`,
                }}
              >
                <Icon
                  className="h-14 w-14"
                  style={{
                    color: "white",
                    filter: "drop-shadow(0 4px 12px hsla(0,0%,0%,0.45))",
                  }}
                />
              </div>
              {isFirst && (
                <>
                  <motion.div
                    className="absolute -top-2 left-4 h-1.5 w-1.5 rounded-full"
                    style={{ background: t.chip }}
                    animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.4, 0.8] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute -bottom-1 right-2 h-2 w-2 rounded-full"
                    style={{ background: t.chip }}
                    animate={{ opacity: [1, 0.3, 1], scale: [1.2, 0.8, 1.2] }}
                    transition={{ duration: 2.4, repeat: Infinity }}
                  />
                  <motion.div
                    className="absolute top-2 -right-2 h-1 w-1 rounded-full"
                    style={{ background: t.chip }}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.8, repeat: Infinity }}
                  />
                </>
              )}
            </motion.div>
          </div>

          {/* Body */}
          <div className="relative px-4 pb-4 pt-2">
            <h4
              className="text-base md:text-lg font-black uppercase tracking-tight leading-tight"
              data-testid={`text-prize-title-${p.id}`}
            >
              {p.title}
            </h4>
            {p.subtitle && (
              <p className="mt-1 text-xs" style={{ color: BSL.muted }}>
                {p.subtitle}
              </p>
            )}

            <div
              className="mt-3 rounded-xl p-3"
              style={{
                background: "hsla(0,0%,0%,0.35)",
                border: `1px solid ${t.ring}33`,
              }}
            >
              <div
                className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1"
                style={{ color: t.chip }}
              >
                Reward
              </div>
              <div
                className="text-sm font-semibold leading-snug"
                style={{ color: "white" }}
              >
                {p.prizeText}
              </div>
              {p.prizeAmountPence != null && p.prizeAmountPence > 0 && (
                <div
                  className="mt-2 inline-flex items-center gap-1 text-xs font-black tabular-nums px-2 py-0.5 rounded"
                  style={{ background: `${t.from}33`, color: t.chip }}
                >
                  {moneyGBP(p.prizeAmountPence)}
                </div>
              )}
            </div>

            {/* Tap hint */}
            <div className="mt-3 flex items-center justify-between">
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] font-bold"
                style={{ color: BSL.muted }}
              >
                <Info className="h-3 w-3" /> Tap for details
              </span>
              {!p.isPublished && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded"
                  style={{
                    background: "hsla(0,0%,0%,0.5)",
                    color: BSL.muted,
                    border: `1px solid hsla(0,0%,100%,0.15)`,
                  }}
                >
                  <Lock className="h-3 w-3" /> Draft
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ===== BACK ===== */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden p-5 flex flex-col"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: `linear-gradient(160deg, ${t.from}22, hsla(222,60%,6%,0.98) 60%)`,
            border: `1px solid ${t.ring}88`,
            boxShadow: `0 24px 60px -10px ${t.glow}, inset 0 0 60px ${t.from}22`,
          }}
        >
          {/* Back rim */}
          <div
            className="absolute inset-x-0 top-0 h-px"
            style={{
              background: `linear-gradient(90deg, transparent, ${t.ring}, transparent)`,
            }}
          />
          <motion.div
            className="pointer-events-none absolute -bottom-20 -left-20 h-64 w-64 rounded-full blur-3xl opacity-40"
            style={{
              background: `radial-gradient(circle, ${t.from}, transparent 70%)`,
            }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Header */}
          <div className="relative flex items-center justify-between mb-3">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md"
              style={{
                background: `linear-gradient(135deg, ${t.from}, ${t.to})`,
                color: "hsl(222,50%,8%)",
              }}
            >
              <Icon className="h-3 w-3" /> {t.label} · #{p.rank}
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                setFlipped(false);
                burstSparks();
              }}
              className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded-md"
              style={{
                background: "hsla(0,0%,0%,0.45)",
                color: "white",
                border: "1px solid hsla(0,0%,100%,0.15)",
              }}
              data-testid={`button-flip-back-${p.id}`}
            >
              <RotateCcw className="h-3 w-3" /> Back
            </button>
          </div>

          {/* Title */}
          <h4 className="relative text-lg md:text-xl font-black uppercase tracking-tight leading-tight">
            {p.title}
          </h4>
          {p.subtitle && (
            <p
              className="relative mt-1 text-xs italic"
              style={{ color: t.chip }}
            >
              {p.subtitle}
            </p>
          )}

          {/* Cash hero */}
          {p.prizeAmountPence != null && p.prizeAmountPence > 0 && (
            <div
              className="relative mt-4 text-center rounded-xl py-3"
              style={{
                background: `linear-gradient(135deg, ${t.from}33, transparent)`,
                border: `1px solid ${t.ring}55`,
              }}
            >
              <div
                className="text-[10px] font-black uppercase tracking-[0.3em]"
                style={{ color: t.chip }}
              >
                Cash Prize
              </div>
              <div
                className="text-3xl font-black tabular-nums"
                style={{ color: "white", textShadow: `0 0 16px ${t.glow}` }}
              >
                {moneyGBP(p.prizeAmountPence)}
              </div>
            </div>
          )}

          {/* What's included */}
          <div className="relative mt-4 flex-1">
            <div
              className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1.5"
              style={{ color: t.chip }}
            >
              What you win
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "white" }}>
              {p.prizeText}
            </p>
          </div>

          {/* How to win footer */}
          <div
            className="relative mt-3 pt-3"
            style={{ borderTop: `1px solid ${t.ring}33` }}
          >
            <div
              className="text-[10px] font-bold uppercase tracking-[0.22em] mb-1"
              style={{ color: BSL.muted }}
            >
              How to win
            </div>
            <p className="text-xs leading-snug" style={{ color: BSL.muted }}>
              Finish the season at{" "}
              <strong style={{ color: t.chip }}>rank #{p.rank}</strong>
              {p.category ? (
                <>
                  {" "}
                  in{" "}
                  <strong style={{ color: t.chip }}>
                    {CATEGORY_LABEL[p.category] || p.category}
                  </strong>
                </>
              ) : null}
              {p.division ? (
                <>
                  {" "}
                  of the <strong style={{ color: t.chip }}>
                    {p.division}
                  </strong>{" "}
                  division
                </>
              ) : null}{" "}
              to claim this reward.
            </p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function EmptyState({ isAdmin }: { isAdmin: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-10 text-center rounded-2xl p-10"
      style={{
        background: "hsla(0,0%,100%,0.03)",
        border: `1px dashed hsla(0,0%,100%,0.15)`,
      }}
    >
      <Trophy className="h-12 w-12 mx-auto mb-3" style={{ color: BSL.muted }} />
      <h3 className="text-lg font-black uppercase tracking-wider">
        Prize vault is empty
      </h3>
      <p className="text-sm mt-1" style={{ color: BSL.muted }}>
        The Super Admin hasn't added any year-end prizes yet.
      </p>
      {isAdmin && (
        <div className="mt-5">
          <Link href="/admin/prizes">
            <ActionButton
              variant="gold"
              icon={<Sparkles className="h-4 w-4" />}
            >
              Set up prizes
            </ActionButton>
          </Link>
        </div>
      )}
    </motion.div>
  );
}
