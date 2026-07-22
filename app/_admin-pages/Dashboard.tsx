import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Link } from "@/lib/routing";
import {
  Activity,
  Users,
  Building2,
  AlertTriangle,
  Radio,
  CheckCircle2,
  Clock,
  ShieldAlert,
  ArrowUpRight,
  Zap,
  CreditCard,
  ClipboardEdit,
  Settings,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { BSL } from "@/components/bsl/BSLPalette";

function StatCard({
  label,
  value,
  icon: Icon,
  tone,
  delay = 0,
  hint,
  href,
}: any) {
  const colorMap: any = {
    gold: BSL.gold,
    cyan: BSL.cyan,
    danger: BSL.danger,
    success: BSL.success,
    muted: BSL.muted,
  };
  const c = colorMap[tone] || BSL.gold;
  const inner = (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      whileHover={{ y: -3, scale: 1.02 }}
      className="relative p-5 rounded-2xl overflow-hidden cursor-pointer"
      style={{
        background: `linear-gradient(135deg, ${BSL.card} 0%, ${BSL.cardSoft} 100%)`,
        border: `1px solid ${c}33`,
        boxShadow: `0 8px 32px hsla(222,60%,2%,0.4), inset 0 1px 0 hsla(0,0%,100%,0.04)`,
      }}
      data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-10"
        style={{ background: c, filter: "blur(30px)" }}
      />
      <div className="flex items-center justify-between mb-3">
        <div
          className="p-2 rounded-lg"
          style={{ background: `${c}22`, color: c }}
        >
          <Icon className="h-4 w-4" />
        </div>
        {href && (
          <ArrowUpRight className="h-3 w-3" style={{ color: BSL.muted }} />
        )}
      </div>
      <div
        className="text-3xl md:text-4xl font-black mb-1 tabular-nums"
        style={{ color: c }}
      >
        {value ?? "—"}
      </div>
      <div
        className="text-[10px] uppercase tracking-widest font-bold"
        style={{ color: BSL.muted }}
      >
        {label}
      </div>
      {hint && (
        <div className="text-[10px] mt-1" style={{ color: BSL.faint }}>
          {hint}
        </div>
      )}
    </motion.div>
  );
  return href ? (
    <Link href={href}>{inner}</Link>
  ) : (
    inner
  );
}

export default function BslAdminDashboard() {
  const { data: dash } = useQuery<any>({
    queryKey: ["/api/bsl/admin/dashboard"],
    refetchInterval: 10000,
  });
  const { data: audit } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/audit"],
    refetchInterval: 30000,
  });

  const alerts: Array<{
    tone: string;
    icon: any;
    msg: string;
    href: string | null;
  }> = [];
  if (dash?.pendingPayments > 0)
    alerts.push({
      tone: "gold",
      icon: CreditCard,
      msg: `${dash.pendingPayments} payment${dash.pendingPayments > 1 ? "s" : ""} pending verification`,
      href: "/admin/payments",
    });
  if (dash?.flaggedClubs > 0)
    alerts.push({
      tone: "danger",
      icon: AlertTriangle,
      msg: `${dash.flaggedClubs} club${dash.flaggedClubs > 1 ? "s" : ""} flagged`,
      href: "/admin/clubs?status=flagged",
    });
  if (dash?.suspendedPlayers > 0)
    alerts.push({
      tone: "danger",
      icon: ShieldAlert,
      msg: `${dash.suspendedPlayers} suspended player${dash.suspendedPlayers > 1 ? "s" : ""}`,
      href: "/admin/players",
    });
  if (dash?.liveMatches > 0)
    alerts.push({
      tone: "cyan",
      icon: Radio,
      msg: `${dash.liveMatches} match${dash.liveMatches > 1 ? "es" : ""} LIVE on ${dash.liveCourts} court${dash.liveCourts > 1 ? "s" : ""}`,
      href: "/admin/match-day",
    });
  if (alerts.length === 0)
    alerts.push({
      tone: "success",
      icon: CheckCircle2,
      msg: "All systems nominal",
      href: null,
    });

  return (
    <AdminLayout active="dashboard">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
          Operations <span style={{ color: BSL.gold }}>Dashboard</span>
        </h1>
        <p className="text-sm mt-1" style={{ color: BSL.muted }}>
          Real-time league overview · auto-refreshes every 10s
        </p>
      </div>

      {/* === ALERT FEED === */}
      <div className="mb-6 space-y-2">
        {alerts.map((a, i) => {
          const c =
            a.tone === "gold"
              ? BSL.gold
              : a.tone === "cyan"
                ? BSL.cyan
                : a.tone === "danger"
                  ? BSL.danger
                  : BSL.success;
          const Icon = a.icon;
          const inner = (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={{ x: 3 }}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border-l-4"
              style={{ background: `${c}11`, borderColor: c }}
              data-testid={`alert-${i}`}
            >
              <Icon className="h-4 w-4 flex-shrink-0" style={{ color: c }} />
              <span className="text-sm font-bold flex-1">{a.msg}</span>
              {a.href && (
                <ArrowUpRight className="h-3 w-3" style={{ color: c }} />
              )}
            </motion.div>
          );
          return a.href ? (
            <Link key={i} href={a.href}>
              {inner}
            </Link>
          ) : (
            <div key={i}>{inner}</div>
          );
        })}
      </div>

      {/* === KEY METRICS === */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Active Clubs"
          value={dash?.activeClubs}
          hint={`${dash?.totalClubs || 0} total`}
          icon={Building2}
          tone="gold"
          delay={0.05}
          href="/admin/clubs"
        />
        <StatCard
          label="Active Players"
          value={dash?.activePlayers}
          hint={`${dash?.totalPlayers || 0} total`}
          icon={Users}
          tone="cyan"
          delay={0.1}
          href="/admin/players"
        />
        <StatCard
          label="Today's Matches"
          value={dash?.todaysMatches}
          hint={`${dash?.completedMatches || 0} completed`}
          icon={Activity}
          tone="gold"
          delay={0.15}
          href="/admin/match-day"
        />
        <StatCard
          label="Pending Payments"
          value={dash?.pendingPayments}
          hint="needs review"
          icon={CreditCard}
          tone={dash?.pendingPayments ? "gold" : "muted"}
          delay={0.2}
          href="/admin/payments"
        />
        <StatCard
          label="Live Courts"
          value={dash?.liveCourts}
          hint={`${dash?.liveMatches || 0} matches LIVE`}
          icon={Radio}
          tone="cyan"
          delay={0.25}
          href="/admin/match-day"
        />
        <StatCard
          label="Flagged Clubs"
          value={dash?.flaggedClubs}
          icon={AlertTriangle}
          tone={dash?.flaggedClubs ? "danger" : "muted"}
          delay={0.3}
          href="/admin/clubs"
        />
        <StatCard
          label="Suspensions"
          value={dash?.suspendedPlayers}
          icon={ShieldAlert}
          tone={dash?.suspendedPlayers ? "danger" : "muted"}
          delay={0.35}
          href="/admin/players"
        />
        <StatCard
          label="Completed"
          value={dash?.completedMatches}
          icon={CheckCircle2}
          tone="success"
          delay={0.4}
        />
        <StatCard
          label="Quick Results"
          value="Enter"
          hint="type all rubber scores in one form"
          icon={ClipboardEdit}
          tone="cyan"
          delay={0.45}
          href="/admin/quick-results"
        />
        <StatCard
          label="Competition"
          value="Rules"
          hint="per-category settings · regenerate · version history"
          icon={Settings}
          tone="gold"
          delay={0.5}
          href="/admin/competition"
        />
      </div>

      {/* === AUDIT FEED === */}
      <GlowPanel
        title="Audit Log"
        subtitle="Recent admin actions"
        tone="cyan"
        icon={<Clock className="h-4 w-4" />}
      >
        {!audit?.length ? (
          <div
            className="py-6 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            No actions logged yet.
          </div>
        ) : (
          <div className="space-y-1 max-h-[420px] overflow-y-auto">
            {audit.slice(0, 50).map((a) => (
              <div
                key={a.id}
                className="flex items-center gap-3 px-3 py-2 rounded-lg text-xs"
                style={{ background: "hsla(0,0%,100%,0.02)" }}
                data-testid={`audit-${a.id}`}
              >
                <Zap className="h-3 w-3" style={{ color: BSL.cyan }} />
                <span
                  className="font-black uppercase tracking-widest"
                  style={{ color: BSL.gold }}
                >
                  {a.action}
                </span>
                <span style={{ color: BSL.muted }}>
                  {a.entity}
                  {a.entityId ? ` #${a.entityId}` : ""}
                </span>
                <span className="ml-auto" style={{ color: BSL.faint }}>
                  {a.actorName} ·{" "}
                  {new Date(a.createdAt).toLocaleString("en-GB")}
                </span>
              </div>
            ))}
          </div>
        )}
      </GlowPanel>
    </AdminLayout>
  );
}
