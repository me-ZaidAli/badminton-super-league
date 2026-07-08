import { useRef, useState } from "react";
import { Link } from "@/lib/routing";
import { motion } from "framer-motion";
import {
  Activity,
  Calendar,
  Clock,
  MapPin,
  Swords,
  Trophy,
  ChevronRight,
  Users,
  Download,
  Loader2,
} from "lucide-react";
import { BSL } from "./BSLPalette";

function slugify(s: string) {
  return (
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "fixture"
  );
}

type Player = { id: number; name: string };
type Pair = {
  id: number;
  name: string;
  category: string | null;
  members: Player[];
};
type Rubber = {
  id: number;
  rubberNumber: number;
  rubberType: string;
  status: string | null;
  homeScore: number | null;
  awayScore: number | null;
  homePair: Pair | null;
  awayPair: Pair | null;
};

export interface FixtureBattleProps {
  id: number;
  status: string;
  startTime: string | Date | null;
  court: number | null;
  category: string | null;
  division: string | null;
  homeRubbers: number;
  awayRubbers: number;
  homePoints?: number;
  awayPoints?: number;
  homeSets?: number;
  awaySets?: number;
  homeClubName: string;
  awayClubName: string;
  homeClubLogo: string | null;
  awayClubLogo: string | null;
  rubbers: Rubber[];
}

function statusTone(status: string) {
  if (status === "LIVE")
    return { color: BSL.danger, label: "● LIVE NOW", pulse: true };
  if (status === "WARMUP")
    return { color: BSL.cyan, label: "WARMING UP", pulse: true };
  if (status === "FINISHED")
    return { color: BSL.muted, label: "FULL TIME", pulse: false };
  return { color: BSL.gold, label: "UPCOMING", pulse: false };
}

// Strip noisy prefixes so pair labels show as "Pair A" rather than
// "Dragon Badminton Club Social Division MD Pair A". The source name
// usually contains "… Pair X" at the end — keep just that, otherwise
// fall back to the last 2 words (e.g. "Team 3").
function shortPairLabel(name: string | null | undefined): string {
  if (!name) return "Pair";
  const trimmed = name.trim();
  const m = trimmed.match(/\bpair\s+([a-z0-9]+)\s*$/i);
  if (m) return `Pair ${m[1].toUpperCase()}`;
  const parts = trimmed.split(/\s+/);
  if (parts.length <= 2) return trimmed;
  return parts.slice(-2).join(" ");
}

function pairLabel(p: Pair | null): {
  line: string;
  players: string[];
  isTBA: boolean;
} {
  if (!p) return { line: "TBA", players: [], isTBA: true };
  const players = (p.members || []).map((m) => m.name).filter(Boolean);
  return { line: shortPairLabel(p.name), players, isTBA: players.length === 0 };
}

function ClubCrest({
  name,
  logo,
  leader,
  side,
}: {
  name: string;
  logo: string | null;
  leader: boolean;
  side: "home" | "away";
}) {
  const accent = side === "home" ? BSL.cyan : BSL.gold;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.92 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="flex flex-col items-center text-center gap-2 min-w-0 w-full"
      data-testid={`battle-${side}`}
    >
      <div
        className="relative shrink-0 h-14 w-14 sm:h-16 sm:w-16 md:h-20 md:w-20 rounded-2xl overflow-hidden flex items-center justify-center text-lg sm:text-2xl font-black"
        style={{
          background: `linear-gradient(135deg, ${accent}33, ${accent}11)`,
          border: `2px solid ${leader ? BSL.gold : accent + "66"}`,
          boxShadow: leader
            ? `0 0 28px ${BSL.gold}88, inset 0 0 16px ${BSL.gold}33`
            : `0 0 20px ${accent}44, inset 0 0 10px ${accent}22`,
          color: leader ? BSL.gold : accent,
        }}
      >
        {logo ? (
          <img
            src={logo}
            alt={name}
            crossOrigin="anonymous"
            className="h-full w-full object-cover"
          />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
        {leader && (
          <motion.div
            className="absolute inset-0 pointer-events-none rounded-2xl"
            style={{ boxShadow: `inset 0 0 20px ${BSL.gold}aa` }}
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        )}
      </div>
      <div className="min-w-0 w-full">
        <div
          className="text-[9px] sm:text-[10px] uppercase tracking-[0.22em] font-bold"
          style={{ color: accent }}
        >
          {side === "home" ? "HOME" : "AWAY"}
        </div>
        <div
          className="text-sm sm:text-base md:text-lg font-black leading-tight tracking-tight break-words line-clamp-2"
          style={{
            color: leader ? BSL.gold : "white",
            textShadow: leader
              ? `0 0 14px ${BSL.gold}88`
              : `0 0 10px ${accent}55`,
          }}
          title={name}
          data-testid={`battle-${side}-name`}
        >
          {name}
        </div>
      </div>
    </motion.div>
  );
}

// One side of a rubber — pair label + per-player coloured chips.
// Same accent for both players on a pair so it's instantly visible
// which two players are partnered. The opposite pair uses a different
// accent (cyan home / gold away).
function PairBlock({
  side,
  label,
  players,
  isTBA,
  won,
  hideNames,
}: {
  side: "home" | "away";
  label: string;
  players: string[];
  isTBA: boolean;
  won: boolean;
  hideNames?: boolean;
}) {
  const accent = side === "home" ? BSL.cyan : BSL.gold;
  const align =
    side === "away" ? "items-end text-right" : "items-start text-left";
  return (
    <div className={`flex flex-col gap-1.5 min-w-0 ${align}`}>
      <div
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-widest"
        style={{
          background: `${accent}22`,
          color: won ? BSL.gold : accent,
          border: `1px solid ${accent}55`,
        }}
      >
        {label}
      </div>
      {isTBA ? (
        <div className="text-[11px] italic" style={{ color: BSL.muted }}>
          Awaiting pair
        </div>
      ) : hideNames ? (
        // Single-team-focus privacy: don't reveal opponent player names,
        // just acknowledge there is a pair on the other side.
        <div className="text-[11px] italic" style={{ color: BSL.muted }}>
          Opponent pair
        </div>
      ) : (
        <div
          className={`flex flex-wrap gap-1 ${side === "away" ? "justify-end" : ""}`}
        >
          {players.map((n, i) => (
            <span
              key={i}
              className="inline-block px-2 py-1 rounded-md text-[11px] sm:text-xs font-bold break-words leading-tight"
              style={{
                background: `${accent}1f`,
                color: "white",
                border: `1px solid ${accent}55`,
                boxShadow: won ? `0 0 10px ${BSL.gold}33` : undefined,
              }}
              data-testid={`battle-rubber-player-${side}-${i}`}
            >
              {n}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RubberRow({ r, focus = "both" }: { r: Rubber; focus?: ViewMode }) {
  const homeWon = (r.homeScore || 0) > (r.awayScore || 0);
  const awayWon = (r.awayScore || 0) > (r.homeScore || 0);
  const home = pairLabel(r.homePair);
  const away = pairLabel(r.awayPair);
  const hasScore =
    r.homeScore != null &&
    r.awayScore != null &&
    (r.homeScore > 0 || r.awayScore > 0);

  // Single-team focus: render ONLY the focused team's pair, full-width,
  // with no opponent block at all. Just a small "vs Pair X" line under
  // the pair label so the matchup context is visible without leaking
  // any opponent names.
  if (focus !== "both") {
    const focused = focus === "home" ? home : away;
    const opponent = focus === "home" ? away : home;
    const focusedSide: "home" | "away" = focus;
    const focusedWon = focus === "home" ? homeWon : awayWon;
    const focusedScore = focus === "home" ? r.homeScore : r.awayScore;
    const opponentScore = focus === "home" ? r.awayScore : r.homeScore;
    const accent = focusedSide === "home" ? BSL.cyan : BSL.gold;
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: r.rubberNumber * 0.04, duration: 0.4 }}
        className="relative rounded-xl overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, hsla(195,80%,10%,0.55), hsla(222,60%,5%,0.85) 60%, hsla(195,80%,10%,0.4))",
          border: `1px solid ${accent}77`,
          boxShadow: `0 0 22px ${accent}44, inset 0 0 14px ${accent}1f`,
        }}
        data-testid={`battle-rubber-${r.rubberNumber}`}
      >
        <div
          className="flex items-center justify-between px-3 py-2 border-b"
          style={{
            borderColor: `${accent}33`,
            background: "hsla(0,0%,0%,0.3)",
          }}
        >
          <div
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-widest tabular-nums"
            style={{
              background: `${BSL.gold}22`,
              color: BSL.gold,
              border: `1px solid ${BSL.gold}66`,
              boxShadow: `0 0 10px ${BSL.gold}33`,
            }}
          >
            R{r.rubberNumber} <span className="opacity-60">·</span>{" "}
            {r.rubberType}
          </div>
          {hasScore ? (
            <div className="flex items-center gap-1.5 text-base font-black tabular-nums">
              <span style={{ color: focusedWon ? BSL.gold : "white" }}>
                {focusedScore}
              </span>
              <span className="text-white/40 text-xs">–</span>
              <span className="text-white/70">{opponentScore}</span>
            </div>
          ) : (
            <span
              className="text-[10px] uppercase tracking-[0.2em] font-bold"
              style={{ color: BSL.muted }}
            >
              Not played
            </span>
          )}
        </div>
        <div className="px-4 py-3">
          <div
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest mb-2"
            style={{
              background: `${accent}22`,
              color: focusedWon ? BSL.gold : accent,
              border: `1px solid ${accent}66`,
            }}
          >
            {focused.line}
          </div>
          {focused.isTBA ? (
            <div className="text-sm italic" style={{ color: BSL.muted }}>
              Pair not yet assigned
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {focused.players.map((n, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-md text-sm sm:text-base font-bold break-words"
                  style={{
                    background: `${accent}1a`,
                    color: "white",
                    border: `1px solid ${accent}55`,
                    boxShadow: focusedWon
                      ? `0 0 10px ${BSL.gold}33`
                      : `0 0 8px ${accent}22`,
                  }}
                  data-testid={`battle-rubber-${r.rubberNumber}-player-${i}`}
                >
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black"
                    style={{ background: accent, color: "black" }}
                  >
                    {i + 1}
                  </span>
                  {n}
                </div>
              ))}
            </div>
          )}
          <div
            className="mt-2.5 pt-2 text-[10px] uppercase tracking-[0.22em] font-bold border-t"
            style={{ color: BSL.muted, borderColor: `${accent}22` }}
          >
            vs {opponent.line}
          </div>
        </div>
      </motion.div>
    );
  }

  // "Both teams" view — original side-by-side layout.
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: r.rubberNumber * 0.04, duration: 0.4 }}
      className="relative rounded-xl overflow-hidden"
      style={{
        background:
          "linear-gradient(135deg, hsla(195,80%,10%,0.55), hsla(222,60%,5%,0.78) 50%, hsla(42,80%,10%,0.5))",
        border: `1px solid ${BSL.cyan}66`,
        boxShadow: `0 0 18px ${BSL.cyan}33, inset 0 0 12px ${BSL.cyan}1a`,
      }}
      data-testid={`battle-rubber-${r.rubberNumber}`}
    >
      <div
        className="flex items-center justify-between px-3 py-1.5 border-b"
        style={{
          borderColor: "hsla(0,0%,100%,0.06)",
          background: "hsla(0,0%,0%,0.25)",
        }}
      >
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest tabular-nums"
          style={{
            background: `${BSL.gold}22`,
            color: BSL.gold,
            border: `1px solid ${BSL.gold}55`,
          }}
        >
          R{r.rubberNumber} <span className="opacity-60">·</span> {r.rubberType}
        </div>
        {hasScore ? (
          <div className="flex items-center gap-1.5 text-base font-black tabular-nums">
            <span style={{ color: homeWon ? BSL.gold : "white" }}>
              {r.homeScore}
            </span>
            <span className="text-white/40 text-xs">–</span>
            <span style={{ color: awayWon ? BSL.gold : "white" }}>
              {r.awayScore}
            </span>
          </div>
        ) : (
          <span
            className="text-[9px] uppercase tracking-[0.2em] font-bold"
            style={{ color: BSL.muted }}
          >
            Not played
          </span>
        )}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-2 px-3 py-2.5">
        <PairBlock
          side="home"
          label={home.line}
          players={home.players}
          isTBA={home.isTBA}
          won={homeWon}
        />
        <div
          className="self-stretch flex items-center justify-center px-1 text-[10px] font-black uppercase tracking-widest"
          style={{ color: BSL.muted }}
        >
          vs
        </div>
        <PairBlock
          side="away"
          label={away.line}
          players={away.players}
          isTBA={away.isTBA}
          won={awayWon}
        />
      </div>
    </motion.div>
  );
}

type ViewMode = "both" | "home" | "away";

export function FixtureBattle(p: FixtureBattleProps) {
  const tone = statusTone(p.status);
  // Points decide it, so the big number is points; rubbers/sets sit below.
  const homePts = p.homePoints ?? 0;
  const awayPts = p.awayPoints ?? 0;
  const homeLeads = homePts > awayPts;
  const awayLeads = awayPts > homePts;
  const rubberCount = p.rubbers?.length || 0;
  const dt = p.startTime ? new Date(p.startTime) : null;
  const [viewMode, setViewMode] = useState<ViewMode>("both");

  // Player tally respects the selected team: when a single team is focused,
  // only count that team's players — not the opponent's.
  const playerCount = p.rubbers.reduce((acc, r) => {
    const homeMembers = r.homePair?.members?.length || 0;
    const awayMembers = r.awayPair?.members?.length || 0;
    if (viewMode === "home") return acc + homeMembers;
    if (viewMode === "away") return acc + awayMembers;
    return acc + homeMembers + awayMembers;
  }, 0);

  // Snapshot-to-PNG via html2canvas. We mark the card root with a ref and a
  // `.battle-card-capturing` class while exporting so any elements tagged
  // `data-export-hide` (footer CTA, the export button itself, animated
  // scan-light) are visually removed for a clean printable card.
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  async function downloadPng() {
    if (!cardRef.current || exporting) return;
    setExporting(true);
    const root = cardRef.current;
    root.classList.add("battle-card-capturing");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(root, {
        backgroundColor: "#070c1a",
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: false,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      const namePart =
        viewMode === "home"
          ? slugify(p.homeClubName)
          : viewMode === "away"
            ? slugify(p.awayClubName)
            : `${slugify(p.homeClubName)}-vs-${slugify(p.awayClubName)}`;
      a.download = `bsl-fixture-${p.id}-${namePart}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.error("[FixtureBattle] PNG export failed", e);
    } finally {
      root.classList.remove("battle-card-capturing");
      setExporting(false);
    }
  }

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      className="relative rounded-2xl overflow-hidden [&.battle-card-capturing_[data-export-hide]]:!hidden"
      style={{
        background:
          "radial-gradient(120% 100% at 0% 0%, hsla(195,80%,16%,0.42), transparent 55%), radial-gradient(120% 100% at 100% 0%, hsla(42,80%,18%,0.36), transparent 60%), linear-gradient(160deg, hsla(222,55%,8%,0.95), hsla(222,55%,4%,0.98))",
        border: `1px solid ${tone.color}66`,
        boxShadow: `0 20px 60px hsla(0,0%,0%,0.55), 0 0 0 1px ${tone.color}22, 0 0 40px ${tone.color}22`,
      }}
      data-testid={`battle-card-${p.id}`}
    >
      {/* Floating PNG export button — hidden from the captured image itself. */}
      <button
        type="button"
        onClick={downloadPng}
        disabled={exporting}
        data-export-hide
        className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-widest transition hover:scale-105 disabled:opacity-60"
        style={{
          background: `${BSL.gold}22`,
          color: BSL.gold,
          border: `1px solid ${BSL.gold}66`,
          boxShadow: `0 4px 14px ${BSL.gold}22`,
        }}
        title="Download fixture card as PNG"
        data-testid={`battle-${p.id}-download-png`}
      >
        {exporting ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <Download className="h-3 w-3" />
        )}
        {exporting ? "Saving…" : "PNG"}
      </button>
      {/* Animated diagonal scan-light when LIVE */}
      {p.status === "LIVE" && (
        <motion.div
          data-export-hide
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(115deg, transparent 0%, transparent 40%, hsla(0,90%,60%,0.18) 50%, transparent 60%, transparent 100%)",
          }}
          animate={{ backgroundPosition: ["-200% 0%", "200% 0%"] }}
          transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
        />
      )}

      {/* Bold gold gradient status bar — matches the reference card. */}
      <div
        className="relative flex items-center justify-between gap-3 px-4 sm:px-5 py-2 sm:py-2.5 flex-wrap"
        style={{
          background:
            p.status === "LIVE"
              ? `linear-gradient(90deg, ${BSL.danger}cc, ${BSL.danger}66 60%, transparent)`
              : `linear-gradient(90deg, ${BSL.gold}d9, ${BSL.gold}66 55%, transparent)`,
          borderBottom: `1px solid ${tone.color}55`,
        }}
      >
        <div className="flex items-center gap-2 text-[11px] sm:text-sm uppercase tracking-[0.25em] font-black text-black/85">
          {tone.pulse && (
            <motion.span
              className="inline-block h-2 w-2 rounded-full bg-black/80"
              animate={{ opacity: [0.4, 1, 0.4], scale: [1, 1.3, 1] }}
              transition={{ duration: 1.4, repeat: Infinity }}
            />
          )}
          <span>{tone.label}</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 text-[10px] sm:text-[11px] text-black/75 font-bold">
          {dt && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Calendar className="h-3 w-3" />{" "}
              {dt.toLocaleDateString("en-GB", {
                weekday: "short",
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {dt && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="h-3 w-3" />{" "}
              {dt.toLocaleTimeString("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
          {p.court != null && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> Court {p.court}
            </span>
          )}
        </div>
      </div>

      {/* View-mode toggle — Both teams / Home only / Away only. Hidden from PNG. */}
      <div
        data-export-hide
        className="relative flex items-center justify-center gap-1 px-3 pt-3"
      >
        <div
          className="inline-flex items-center rounded-full p-0.5 gap-0.5"
          style={{
            background: "hsla(0,0%,100%,0.04)",
            border: `1px solid ${BSL.cyan}33`,
          }}
        >
          {(
            [
              { k: "both", label: "Both Teams" },
              { k: "home", label: p.homeClubName },
              { k: "away", label: p.awayClubName },
            ] as { k: ViewMode; label: string }[]
          ).map((opt) => {
            const active = viewMode === opt.k;
            return (
              <button
                key={opt.k}
                type="button"
                onClick={() => setViewMode(opt.k)}
                className="px-2.5 py-1 rounded-full text-[10px] sm:text-[11px] uppercase tracking-widest font-black transition max-w-[10rem] truncate"
                style={{
                  background: active
                    ? `linear-gradient(90deg, ${BSL.cyan}, ${BSL.gold})`
                    : "transparent",
                  color: active ? "black" : "white",
                  boxShadow: active ? `0 0 14px ${BSL.gold}66` : undefined,
                }}
                data-testid={`battle-${p.id}-view-${opt.k}`}
                title={opt.label}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Division/category banner — shown ONCE here, prominently, so the
          individual rubber rows don't need to repeat the long division name. */}
      {(p.division || p.category) && (
        <div className="relative flex justify-center pt-2 sm:pt-3">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] sm:text-[11px] uppercase tracking-[0.25em] font-black"
            style={{
              background: `linear-gradient(90deg, ${BSL.cyan}1f, ${BSL.gold}1f)`,
              color: "white",
              border: `1px solid ${BSL.gold}44`,
              boxShadow: `0 0 18px ${BSL.gold}22`,
            }}
            data-testid={`battle-${p.id}-division`}
          >
            {p.division}
            {p.division && p.category && (
              <span className="text-white/40">·</span>
            )}
            {p.category}
          </div>
        </div>
      )}

      {/* Battle row — full vs in "both" mode, single focused crest otherwise. */}
      {viewMode === "both" ? (
        <div className="relative grid grid-cols-[1fr_auto_1fr] items-start gap-2 sm:gap-4 px-3 sm:px-5 py-4 sm:py-5">
          <ClubCrest
            name={p.homeClubName}
            logo={p.homeClubLogo}
            leader={homeLeads}
            side="home"
          />
          <div className="flex flex-col items-center gap-1 shrink-0 pt-2 sm:pt-3">
            <div className="flex items-center gap-1.5 sm:gap-2 text-3xl sm:text-4xl md:text-5xl font-black tabular-nums leading-none">
              <span
                style={{
                  color: homeLeads ? BSL.gold : "white",
                  textShadow: homeLeads ? `0 0 18px ${BSL.gold}aa` : undefined,
                }}
                data-testid={`battle-${p.id}-home-score`}
              >
                {homePts}
              </span>
              <motion.span
                className="text-white/50"
                animate={
                  p.status === "LIVE"
                    ? { scale: [1, 1.08, 1], rotate: [-2, 2, -2] }
                    : {}
                }
                transition={{ duration: 1.6, repeat: Infinity }}
              >
                <Swords className="h-5 w-5 sm:h-7 sm:w-7" />
              </motion.span>
              <span
                style={{
                  color: awayLeads ? BSL.gold : "white",
                  textShadow: awayLeads ? `0 0 18px ${BSL.gold}aa` : undefined,
                }}
                data-testid={`battle-${p.id}-away-score`}
              >
                {awayPts}
              </span>
            </div>
            <div
              className="text-[8px] sm:text-[9px] uppercase tracking-[0.22em] font-bold whitespace-nowrap text-center"
              style={{ color: BSL.muted }}
            >
              Points · {p.homeRubbers}–{p.awayRubbers} rubbers
            </div>
          </div>
          <ClubCrest
            name={p.awayClubName}
            logo={p.awayClubLogo}
            leader={awayLeads}
            side="away"
          />
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-2 px-4 py-5">
          <ClubCrest
            name={viewMode === "home" ? p.homeClubName : p.awayClubName}
            logo={viewMode === "home" ? p.homeClubLogo : p.awayClubLogo}
            leader={viewMode === "home" ? homeLeads : awayLeads}
            side={viewMode}
          />
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] uppercase tracking-[0.22em] font-bold"
            style={{
              background: "hsla(0,0%,100%,0.04)",
              border: `1px solid ${BSL.cyan}33`,
              color: BSL.muted,
            }}
          >
            Single-team line-up · vs{" "}
            {viewMode === "home" ? p.awayClubName : p.homeClubName}
          </div>
        </div>
      )}

      {/* Rubber breakdown — pair names */}
      {rubberCount > 0 && (
        <div
          className="relative border-t px-3 sm:px-4 py-3 sm:py-4 space-y-2"
          style={{ borderColor: "hsla(0,0%,100%,0.06)" }}
        >
          <div className="flex items-center justify-between gap-2 px-1 mb-1 flex-wrap">
            <div
              className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold"
              style={{ color: BSL.cyan }}
            >
              <Trophy className="h-3 w-3" /> Battle Card · {rubberCount}{" "}
              {rubberCount === 1 ? "Rubber" : "Rubbers"}
            </div>
            {playerCount > 0 && (
              <div
                className="inline-flex items-center gap-1 text-[10px]"
                style={{ color: BSL.muted }}
              >
                <Users className="h-3 w-3" /> {playerCount} players
              </div>
            )}
          </div>
          <div
            className={
              viewMode === "both"
                ? "grid grid-cols-1 md:grid-cols-2 gap-2"
                : "grid grid-cols-1 gap-2.5"
            }
          >
            {p.rubbers.map((r) => (
              <RubberRow key={r.id} r={r} focus={viewMode} />
            ))}
          </div>
        </div>
      )}

      {/* Footer CTA */}
      <Link href={`/match/${p.id}`}>
        <a
          data-export-hide
          className="relative flex items-center justify-between px-4 sm:px-5 py-2.5 sm:py-3 text-[11px] sm:text-xs font-bold transition-colors hover:bg-white/5"
          style={{
            background: "hsla(0,0%,0%,0.32)",
            color: BSL.cyan,
            borderTop: `1px solid ${tone.color}33`,
          }}
          data-testid={`battle-${p.id}-open`}
        >
          <span className="inline-flex items-center gap-1.5 uppercase tracking-widest">
            <Activity className="h-3 w-3" /> Open match centre
          </span>
          <span className="inline-flex items-center gap-1 uppercase tracking-widest">
            View <ChevronRight className="h-3 w-3" />
          </span>
        </a>
      </Link>
    </motion.div>
  );
}
