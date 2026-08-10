import { ReactNode, useState } from "react";
import { Link, useLocation } from "@/lib/routing";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Trophy,
  Radio,
  Building2,
  Users,
  CreditCard,
  Image as ImageIcon,
  Settings,
  Menu,
  X,
  ArrowLeft,
  ShieldCheck,
  Bell,
  Sliders,
  CalendarDays,
  Trophy as TrophyIcon,
} from "lucide-react";
import { BSL } from "@/components/bsl/BSLPalette";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-auth";
const bslLogo = "/bsl_logo.png";

const NAV = [
  {
    key: "dashboard",
    href: "/admin",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    key: "league",
    href: "/admin/league",
    label: "League Control",
    icon: Trophy,
  },
  {
    key: "competition",
    href: "/admin/competition",
    label: "Competition Rules",
    icon: Sliders,
  },
  {
    key: "match-days",
    href: "/admin/match-days",
    label: "Match Days",
    icon: CalendarDays,
  },
  {
    key: "match-day",
    href: "/admin/match-day",
    label: "Match Day Live",
    icon: Radio,
  },
  {
    key: "prizes",
    href: "/admin/prizes",
    label: "Prize Vault",
    icon: TrophyIcon,
  },
  { key: "clubs", href: "/admin/clubs", label: "Clubs", icon: Building2 },
  { key: "players", href: "/admin/players", label: "Players", icon: Users },
  {
    key: "payments",
    href: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
  },
  { key: "media", href: "/admin/media", label: "Media", icon: ImageIcon },
  {
    key: "settings",
    href: "/admin/settings",
    label: "Settings",
    icon: Settings,
  },
];

export function AdminLayout({
  active,
  children,
}: {
  active: string;
  children: ReactNode;
}) {
  const [, setLoc] = useLocation();
  const [open, setOpen] = useState(false);
  const { data: user } = useUser();
  const { data: dash } = useQuery<any>({
    queryKey: ["/api/bsl/admin/dashboard"],
    refetchInterval: 15000,
  });

  const role =
    (user as any)?.role === "OWNER" ? "Super Admin" : "Operations Admin";
  const pending = dash?.pendingPayments || 0;

  const navContent = (
    <>
      <nav className="p-3 space-y-1">
        {NAV.map((item) => {
          const Active = active === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => {
                setLoc(item.href);
                setOpen(false);
              }}
              className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all relative overflow-hidden group"
              style={{
                background: Active
                  ? `linear-gradient(90deg, ${BSL.gold}22, transparent)`
                  : "transparent",
                color: Active ? BSL.gold : "white",
              }}
              data-testid={`nav-${item.key}`}
            >
              {Active && (
                <motion.div
                  layoutId="adminNavActiveBar"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-6 rounded-r-full"
                  style={{
                    background: BSL.gold,
                    boxShadow: `0 0 12px ${BSL.gold}`,
                  }}
                />
              )}
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-bold uppercase tracking-wider">
                {item.label}
              </span>
              {item.key === "payments" && pending > 0 && (
                <span
                  className="ml-auto text-[10px] px-2 py-0.5 rounded-full font-black"
                  style={{ background: BSL.gold, color: BSL.bgDeep }}
                >
                  {pending}
                </span>
              )}
            </button>
          );
        })}
      </nav>
      <div
        className="absolute bottom-3 left-3 right-3 p-3 rounded-xl text-[11px]"
        style={{
          background: BSL.cardSoft,
          color: BSL.muted,
          border: `1px solid ${BSL.border}`,
        }}
      >
        <div
          className="font-black uppercase tracking-widest mb-1"
          style={{ color: BSL.cyan }}
        >
          System
        </div>
        <div>Live · {dash?.liveMatches ?? 0} matches</div>
        <div>{dash?.activeClubs ?? 0} active clubs</div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen text-white" style={{ background: BSL.bgDeep }}>
      <BSLBackground />
      {/* === TOPBAR === */}
      <div
        className="sticky top-0 z-40 backdrop-blur-xl border-b"
        style={{ borderColor: BSL.border, background: "hsla(222,55%,5%,0.85)" }}
      >
        <div className="flex items-center gap-3 px-4 lg:px-6 h-16 lg:h-14">
          <button
            onClick={() => setOpen((o) => !o)}
            className="lg:hidden p-3 rounded-xl active:scale-95 transition"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
            }}
            aria-label="Toggle navigation"
            data-testid="button-mobile-nav"
          >
            {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
          </button>
          {/* Spacer pushes the back-arrow well clear of the menu button on mobile */}
          <div className="lg:hidden w-3" />
          <Link href="/bsl">
            <a
              className="inline-flex items-center justify-center h-10 w-10 lg:h-auto lg:w-auto rounded-lg lg:rounded-none lg:gap-2 text-xs uppercase tracking-widest"
              style={{ color: BSL.muted, background: "transparent" }}
              data-testid="link-back-to-bsl"
            >
              <ArrowLeft className="h-4 w-4 lg:h-3 lg:w-3" />
            </a>
          </Link>
          <Link href="/admin">
            <a
              className="inline-flex items-center gap-2.5"
              data-testid="link-bsl-logo"
            >
              <img
                src={bslLogo}
                alt="BSL"
                className="h-8 w-auto select-none"
                draggable={false}
                style={{ filter: `drop-shadow(0 0 12px ${BSL.cyan}55)` }}
              />
              <div
                className="hidden md:block h-5 w-px"
                style={{ background: BSL.border }}
              />
              <span
                className="hidden md:inline font-black uppercase tracking-tight text-sm"
                style={{ color: BSL.gold }}
              >
                Control Panel
              </span>
            </a>
          </Link>
          <div className="flex-1" />
          {pending > 0 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{
                background: `${BSL.gold}22`,
                color: BSL.gold,
                boxShadow: `0 0 0 1px ${BSL.gold}55`,
              }}
              data-testid="badge-pending-alerts"
            >
              <Bell className="h-3 w-3" /> {pending} pending
            </motion.div>
          )}
          <div className="text-xs hidden md:flex items-center gap-2">
            <span
              className="px-2 py-1 rounded-md text-[10px] uppercase font-black tracking-widest"
              style={{ background: `${BSL.cyan}22`, color: BSL.cyan }}
            >
              {role}
            </span>
            <span className="text-white/60">
              {(user as any)?.fullName || (user as any)?.username || "Admin"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* === LEFT NAV (desktop) === */}
        {/* Always rendered; visibility is CSS-only (`hidden lg:block`) so the
            server and client markup match — no `typeof window` branching. */}
        <aside
          className="hidden lg:sticky lg:top-14 lg:block lg:w-64 lg:h-[calc(100vh-3.5rem)]"
          style={{
            background: "hsla(222,55%,5%,0.95)",
            borderRight: `1px solid ${BSL.border}`,
          }}
        >
          {navContent}
        </aside>

        {/* === LEFT NAV (mobile drawer) === */}
        {/* Only mounted client-side once opened, so there's nothing to mismatch on hydration. */}
        <AnimatePresence>
          {open && (
            <motion.aside
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-y-14 left-0 z-30 w-64 lg:hidden"
              style={{
                background: "hsla(222,55%,5%,0.95)",
                borderRight: `1px solid ${BSL.border}`,
              }}
            >
              {navContent}
            </motion.aside>
          )}
        </AnimatePresence>

        {/* === MAIN === */}
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 pb-24 max-w-[1600px] mx-auto w-full">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
