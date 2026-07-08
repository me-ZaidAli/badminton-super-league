import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Activity,
  Award,
  Crown,
  Flame,
  Shield,
  Swords,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { DASH } from "./StatsPalette";

type PlayerRow = {
  playerId: number;
  fullName: string;
  clubId: number | null;
  clubName: string;
  clubLogo: string | null;
  division: string;
  matchesPlayed: number;
  won: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  winRate: number;
  points: number;
  position: number;
};

function StatChip({
  label,
  value,
  sub,
  icon,
  tone = "accent",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "accent" | "win" | "loss" | "neutral";
}) {
  const accent =
    tone === "win"
      ? DASH.win
      : tone === "loss"
        ? DASH.loss
        : tone === "neutral"
          ? DASH.neutral
          : DASH.accent;
  return (
    <div
      className="relative overflow-hidden rounded-xl px-3 py-2.5"
      style={{ background: DASH.card, border: `1px solid ${DASH.border}` }}
      data-testid={`battlecard-stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className="text-[9px] uppercase tracking-[0.18em]"
          style={{ color: DASH.muted }}
        >
          {label}
        </span>
        {icon && <span style={{ color: accent }}>{icon}</span>}
      </div>
      <div
        className="mt-1 text-xl font-bold tabular-nums"
        style={{ color: DASH.text }}
      >
        {value}
      </div>
      {sub && (
        <div className="text-[10px]" style={{ color: DASH.muted }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function PlayerBattlecard({
  open,
  onOpenChange,
  playerId,
  fallbackName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  playerId: number | null;
  fallbackName?: string;
}) {
  // Primary: self-sufficient single-player endpoint (real points even when the
  // full leaderboard list isn't loaded). 404 = player hasn't played yet.
  const {
    data: single,
    isLoading: singleLoading,
    isError: singleError,
  } = useQuery<PlayerRow>({
    queryKey: ["/api/bsl/players", playerId, "stats"],
    enabled: open && playerId != null,
    retry: false,
    queryFn: async () => {
      const r = await fetch(`/api/bsl/players/${playerId}/stats`, {
        credentials: "include",
      });
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });
  // Fallback: the full leaderboard list (only fetched if the single fetch failed).
  const { data: leaderboard = [], isLoading: lbLoading } = useQuery<
    PlayerRow[]
  >({
    queryKey: ["/api/bsl/player-leaderboard"],
    enabled: open && playerId != null && singleError,
  });

  const isLoading = singleLoading || (singleError && lbLoading);
  const player = useMemo(
    () => single || leaderboard.find((p) => p.playerId === playerId) || null,
    [single, leaderboard, playerId],
  );

  const name = player?.fullName || fallbackName || "Player";
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "P";
  const avgPts =
    player && player.matchesPlayed > 0
      ? Math.round(player.points / player.matchesPlayed)
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-md p-0 overflow-hidden border-0 gap-0"
        style={{
          background: DASH.bg,
          border: `1px solid ${DASH.borderStrong}`,
          boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
        }}
        data-testid="dialog-player-battlecard"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{name} — Player Stats</DialogTitle>
          <DialogDescription>BSL player statistics card</DialogDescription>
        </DialogHeader>

        {/* HEADER */}
        <div
          className="px-5 pt-5 pb-4"
          style={{
            background: `linear-gradient(135deg, ${DASH.panel}, ${DASH.bgAlt})`,
            borderBottom: `1px solid ${DASH.border}`,
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <span
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: DASH.muted }}
            >
              <Swords className="h-3.5 w-3.5" style={{ color: DASH.accent }} />{" "}
              Player Stats
            </span>
            {player && (
              <span
                className="inline-flex items-center gap-1 text-[11px] font-semibold"
                style={{ color: DASH.textDim }}
              >
                <Crown className="h-3.5 w-3.5" style={{ color: DASH.accent }} />{" "}
                Rank #{player.position}
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35 }}
              className="relative h-16 w-16 shrink-0 rounded-2xl flex items-center justify-center text-xl font-bold"
              style={{
                background: DASH.card,
                border: `1px solid ${DASH.borderStrong}`,
                color: DASH.accent,
              }}
            >
              {initials}
            </motion.div>
            <div className="min-w-0">
              <div
                className="text-lg font-bold leading-tight break-words"
                style={{ color: DASH.text }}
                data-testid="battlecard-player-name"
              >
                {name}
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                {player?.clubLogo ? (
                  <img
                    src={player.clubLogo}
                    alt=""
                    className="h-4 w-4 rounded object-cover"
                  />
                ) : (
                  <Shield
                    className="h-3.5 w-3.5"
                    style={{ color: DASH.accent }}
                  />
                )}
                <span
                  className="text-[12px] font-medium"
                  style={{ color: DASH.textDim }}
                >
                  {player?.clubName || "—"}
                </span>
                {player?.division && player.division !== "—" && (
                  <span
                    className="text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-md"
                    style={{
                      background: `${DASH.accentStrong}22`,
                      color: DASH.accent,
                      border: `1px solid ${DASH.accent}44`,
                    }}
                  >
                    {player.division}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div
            className="px-5 py-8 text-center text-sm"
            style={{ color: DASH.muted }}
          >
            Loading stats…
          </div>
        ) : !player ? (
          <div
            className="px-5 py-8 text-center text-sm"
            style={{ color: DASH.muted }}
            data-testid="battlecard-empty"
          >
            No match stats yet — this player's card fills up once they've played
            a rubber.
          </div>
        ) : (
          <div className="p-5 space-y-4">
            {/* Win-rate hero bar */}
            <div>
              <div
                className="flex items-center justify-between text-[10px] uppercase tracking-widest mb-1"
                style={{ color: DASH.muted }}
              >
                <span className="inline-flex items-center gap-1">
                  <Target className="h-3 w-3" /> Win Rate
                </span>
                <span
                  className="font-bold tabular-nums"
                  style={{ color: DASH.accent }}
                >
                  {player.winRate}%
                </span>
              </div>
              <div
                className="h-2.5 w-full rounded-full overflow-hidden"
                style={{ background: DASH.card }}
              >
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${player.winRate}%` }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="h-full rounded-full"
                  style={{
                    background: `linear-gradient(90deg, ${DASH.accentStrong}, ${DASH.accent})`,
                  }}
                />
              </div>
            </div>

            {/* Stat grid */}
            <div className="grid grid-cols-3 gap-2.5">
              <StatChip
                label="Points"
                value={player.points}
                icon={<Flame className="h-3.5 w-3.5" />}
                tone="accent"
              />
              <StatChip
                label="Played"
                value={player.matchesPlayed}
                icon={<Activity className="h-3.5 w-3.5" />}
                tone="neutral"
              />
              <StatChip
                label="Won"
                value={player.won}
                icon={<Trophy className="h-3.5 w-3.5" />}
                tone="win"
              />
              <StatChip
                label="Lost"
                value={player.lost}
                icon={<Shield className="h-3.5 w-3.5" />}
                tone="loss"
              />
              <StatChip
                label="Avg Pts"
                value={avgPts}
                sub="per match"
                icon={<TrendingUp className="h-3.5 w-3.5" />}
                tone="accent"
              />
              <StatChip
                label="Rank"
                value={`#${player.position}`}
                icon={<Award className="h-3.5 w-3.5" />}
                tone="accent"
              />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
