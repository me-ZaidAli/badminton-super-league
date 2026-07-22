import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@/lib/routing";
import { motion } from "framer-motion";
import {
  Trophy,
  Users,
  Wallet as WalletIcon,
  Calendar,
  Zap,
  Crown,
  Shield,
  MapPin,
  Sparkles,
  ChevronRight,
  Activity,
  Share2,
  Brain,
  Swords,
  History,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { CountdownTimer } from "@/components/bsl/CountdownTimer";
import { ActionButton } from "@/components/bsl/ActionButton";
import { ShareInviteDialog } from "@/components/bsl/ShareInviteDialog";
import { ClubStatsDialog } from "@/components/bsl/ClubStatsDialog";
import { PlayerBattlecard } from "@/components/bsl/PlayerBattlecard";
import { HeadToHeadDialog } from "@/components/bsl/HeadToHeadDialog";
import { BslSubNav } from "@/components/BslSubNav";
import { StatTile } from "@/components/bsl/StatTile";
import { MatchCard } from "@/components/bsl/MatchCard";
import { FixtureBattle } from "@/components/bsl/FixtureBattle";
import { LeaderRow } from "@/components/bsl/LeaderRow";
import { BSL } from "@/components/bsl/BSLPalette";
import { useUser } from "@/hooks/use-auth";
const bslLogo = "/bsl_logo.png";
const bslHeroPhoto = "/bsl_hero.png";

export default function LeagueMode() {
  const { data: user } = useUser();
  const isAdmin =
    (user as any)?.role === "OWNER" || (user as any)?.role === "ADMIN";
  const [shareOpen, setShareOpen] = useState(false);
  const [statsClub, setStatsClub] = useState<any | null>(null);
  const [battlecardPlayer, setBattlecardPlayer] = useState<{
    id: number;
    name: string;
  } | null>(null);
  const [h2h, setH2h] = useState<{ a: number; b: number } | null>(null);

  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const { data: standings = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/standings"],
  });
  // AI "state of the league" — regenerates server-side whenever a match
  // finishes. Poll every 30s so the board picks up a fresh write on its own.
  const { data: aiSummary } = useQuery<any>({
    queryKey: ["/api/bsl/ai-summary"],
    refetchInterval: 30000,
  });
  // Gaming-style all-clubs leaderboard (points-first) for the Power Rankings panel.
  const { data: clubLeaderboard = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/club-leaderboard"],
  });
  // Recently finished fixtures with scores, polled so results land live.
  const { data: finishedFixtures = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/fixtures", { status: "FINISHED" }],
    refetchInterval: 30000,
    queryFn: async () => {
      const r = await fetch("/api/bsl/fixtures?status=FINISHED", {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load finished fixtures");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  // Poll live/showcase fixtures every 10s so the board updates scores by itself
  // as the admin enters them — no refresh needed.
  const { data: liveFixtures = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/fixtures", { status: "LIVE" }],
    refetchInterval: 10000,
    queryFn: async () => {
      const r = await fetch("/api/bsl/fixtures?status=LIVE", {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load live fixtures");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: upcomingFixtures = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/fixtures", { status: "SCHEDULED" }],
    refetchInterval: 30000,
    queryFn: async () => {
      const r = await fetch("/api/bsl/fixtures?status=SCHEDULED", {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load upcoming fixtures");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: showcase = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/fixtures-showcase"],
    refetchInterval: 10000,
    queryFn: async () => {
      const r = await fetch("/api/bsl/fixtures-showcase?limit=6", {
        credentials: "include",
      });
      if (!r.ok) throw new Error("Failed to load showcase fixtures");
      const data = await r.json();
      return Array.isArray(data) ? data : [];
    },
  });
  const { data: mvp = [] } = useQuery<any[]>({ queryKey: ["/api/bsl/mvp"] });
  const { data: clubs = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/clubs"],
  });
  const { data: mePlayer } = useQuery<any>({
    queryKey: ["/api/bsl/players/me"],
    enabled: !!user,
  });
  const { data: myClub } = useQuery<any>({
    queryKey: ["/api/bsl/my-club"],
    enabled: !!user,
  });
  const isClubManager = !!myClub?.club;

  const activeClubs = clubs.filter((c) => c.status === "ACTIVE").length;
  const totalTeams = standings.length;

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
        title="Share the Birmingham Super League"
        subtitle="Send this link or QR to anyone who wants to sign up and join the BSL."
        shareUrl={
          typeof window !== "undefined" ? `${window.location.origin}/bsl` : ""
        }
        filenameSlug="bsl-league"
      />
      <ClubStatsDialog
        open={!!statsClub}
        onOpenChange={(v) => {
          if (!v) setStatsClub(null);
        }}
        club={statsClub}
        onPlayerClick={(id, name) => setBattlecardPlayer({ id, name })}
      />
      <PlayerBattlecard
        open={!!battlecardPlayer}
        onOpenChange={(v) => {
          if (!v) setBattlecardPlayer(null);
        }}
        playerId={battlecardPlayer?.id ?? null}
        fallbackName={battlecardPlayer?.name}
      />
      <HeadToHeadDialog
        open={!!h2h}
        onOpenChange={(v) => {
          if (!v) setH2h(null);
        }}
        clubA={h2h?.a ?? null}
        clubB={h2h?.b ?? null}
      />
      {/* HERO BANNER */}
      <div className="relative">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-6 md:pt-8">
          <motion.div
            initial={{ opacity: 0, y: -16, scale: 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full overflow-hidden rounded-3xl"
            style={{
              border: `1px solid ${BSL.cyan}33`,
              boxShadow: `0 32px 80px hsla(222,80%,2%,0.6), 0 0 0 1px ${BSL.gold}22`,
            }}
            data-testid="hero-banner"
          >
            <motion.img
              src={bslHeroPhoto}
              alt=""
              className="block w-full h-[260px] sm:h-[340px] md:h-[420px] lg:h-[480px] object-cover select-none"
              draggable={false}
              initial={{ scale: 1.08 }}
              animate={{ scale: 1 }}
              transition={{ duration: 1.6, ease: [0.16, 1, 0.3, 1] }}
            />
            {/* Vignette + colour wash so the photo blends with the BSL palette */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, hsla(222,55%,4%,0.15) 0%, hsla(222,55%,4%,0.0) 35%, hsla(222,55%,4%,0.55) 78%, hsla(222,55%,4%,0.95) 100%)`,
              }}
            />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(60% 80% at 50% 0%, hsla(195,100%,60%,0.18), transparent 60%), radial-gradient(40% 60% at 80% 90%, hsla(42,95%,55%,0.16), transparent 60%)`,
              }}
            />
            {/* Logo + content overlay */}
            <div className="absolute inset-0 flex flex-col justify-end p-5 md:p-8 lg:p-10">
              <motion.img
                src={bslLogo}
                alt="Birmingham Super League"
                className="block w-full max-w-[260px] sm:max-w-[340px] md:max-w-[420px] lg:max-w-[520px] h-auto select-none mb-3 md:mb-4"
                draggable={false}
                initial={{ opacity: 0, y: 16, filter: "blur(10px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{
                  delay: 0.25,
                  duration: 0.9,
                  ease: [0.16, 1, 0.3, 1],
                }}
                style={{
                  filter: `drop-shadow(0 0 36px ${BSL.cyan}66) drop-shadow(0 14px 32px hsla(222,80%,2%,0.85))`,
                }}
              />
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5, duration: 0.6 }}
                className="flex flex-col gap-1.5"
              >
                <span
                  style={{ color: BSL.gold }}
                  className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.28em]"
                >
                  {league?.tagline || "Compete · Connect · Elevate"}
                </span>
                <div
                  className="flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] sm:text-[11px] uppercase tracking-[0.18em]"
                  style={{ color: "hsla(0,0%,100%,0.78)" }}
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3 w-3" style={{ color: BSL.cyan }} />{" "}
                    {league?.venueName || "One Central Venue"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-3 w-3" style={{ color: BSL.cyan }} />{" "}
                    One Saturday / Month
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Trophy className="h-3 w-3" style={{ color: BSL.cyan }} />{" "}
                    12 Days A Year
                  </span>
                </div>
              </motion.div>
            </div>
            {/* Countdown — floating top-right */}
            <motion.div
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="absolute top-4 right-4 md:top-6 md:right-6 rounded-2xl px-4 py-3 backdrop-blur-xl"
              style={{
                background:
                  "linear-gradient(140deg, hsla(42,95%,55%,0.16), hsla(195,100%,60%,0.10))",
                border: `1px solid ${BSL.gold}55`,
                boxShadow: `0 12px 32px hsla(222,80%,2%,0.6)`,
              }}
            >
              <div
                className="text-[9px] md:text-[10px] uppercase tracking-[0.3em] mb-1.5 font-bold"
                style={{ color: BSL.gold }}
              >
                Next League Day
              </div>
              <CountdownTimer target={league?.nextLeagueDay} />
            </motion.div>
          </motion.div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 md:px-8 pt-6">
          {/* QUICK ACTIONS */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mt-7 flex flex-wrap gap-3"
          >
            {!mePlayer && (
              <Link href="/join">
                <ActionButton
                  variant="cyan"
                  icon={<Zap className="h-4 w-4" />}
                >
                  Join as Player
                </ActionButton>
              </Link>
            )}
            {mePlayer && (
              <>
                <Link href="/profile">
                  <ActionButton
                    variant="cyan"
                    icon={<Crown className="h-4 w-4" />}
                  >
                    My BSL Profile
                  </ActionButton>
                </Link>
                <Link href="/wallet">
                  <ActionButton
                    variant="cyan"
                    icon={<WalletIcon className="h-4 w-4" />}
                  >
                    Wallet · £
                    {((mePlayer.walletBalance || 0) / 100).toFixed(2)}
                  </ActionButton>
                </Link>
              </>
            )}
            {isClubManager ? (
              <Link href="/my-club">
                <ActionButton
                  variant="gold"
                  icon={<Shield className="h-4 w-4" />}
                >
                  Manage My Club
                </ActionButton>
              </Link>
            ) : (
              <Link href="/register-club">
                <ActionButton
                  variant="gold"
                  icon={<Shield className="h-4 w-4" />}
                >
                  Register a Club
                </ActionButton>
              </Link>
            )}
            <Link href="/prizes">
              <ActionButton
                variant="gold"
                icon={<Trophy className="h-4 w-4" />}
                data-testid="button-prizes"
              >
                Prize Vault
              </ActionButton>
            </Link>
            <ActionButton
              variant="ghost"
              icon={<Share2 className="h-4 w-4" />}
              onClick={() => setShareOpen(true)}
              data-testid="button-share-bsl"
            >
              Share BSL
            </ActionButton>
            {isAdmin && (
              <>
                <Link href="/admin/verify">
                  <ActionButton
                    variant="ghost"
                    icon={<Sparkles className="h-4 w-4" />}
                  >
                    Verify Payments
                  </ActionButton>
                </Link>
                <Link href="/admin/fixtures">
                  <ActionButton
                    variant="ghost"
                    icon={<Calendar className="h-4 w-4" />}
                  >
                    Fixture Board
                  </ActionButton>
                </Link>
              </>
            )}
          </motion.div>

          {/* STAT STRIP */}
          <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            <StatTile
              label="Active Clubs"
              value={activeClubs}
              sub={`${clubs.length} total registered`}
              icon={<Shield className="h-4 w-4" />}
              tone="gold"
            />
            <StatTile
              label="Teams"
              value={totalTeams}
              sub="competing this season"
              icon={<Users className="h-4 w-4" />}
              tone="cyan"
            />
            <StatTile
              label="Live Matches"
              value={liveFixtures.length}
              sub="right now"
              icon={<Activity className="h-4 w-4" />}
              tone="gold"
            />
            <StatTile
              label="Upcoming"
              value={upcomingFixtures.length}
              sub="next league day"
              icon={<Calendar className="h-4 w-4" />}
              tone="cyan"
            />
          </div>
        </div>
      </div>

      {/* BATTLE SHOWCASE — full-bleed announcement of upcoming/live fixtures */}
      {showcase.length > 0 && (
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 mt-10">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-4 flex items-end justify-between gap-4 flex-wrap"
          >
            <div>
              <div
                className="text-[10px] uppercase tracking-[0.3em] font-black"
                style={{ color: BSL.cyan }}
              >
                Match Day Announcements
              </div>
              <h2 className="text-2xl md:text-4xl font-black uppercase tracking-tight mt-1">
                Battle{" "}
                <span
                  style={{
                    color: BSL.gold,
                    textShadow: `0 0 18px ${BSL.gold}66`,
                  }}
                >
                  Card
                </span>
              </h2>
              <p
                className="text-xs md:text-sm mt-1"
                style={{ color: BSL.muted }}
              >
                Confirmed pairs, every match, every player — heads up before you
                step on court.
              </p>
            </div>
            <div
              className="text-[11px] uppercase tracking-widest font-bold"
              style={{ color: BSL.gold }}
            >
              {showcase.length} {showcase.length === 1 ? "fixture" : "fixtures"}{" "}
              loaded
            </div>
          </motion.div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            {showcase.map((f: any) => (
              <FixtureBattle key={f.id} {...f} />
            ))}
          </div>
        </div>
      )}

      {/* AI LEAGUE UPDATE */}
      {aiSummary?.text && (
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 mt-10">
          <GlowPanel
            title="State of the League"
            subtitle="AI match-day briefing"
            tone="cyan"
            icon={<Brain className="h-4 w-4" />}
            action={
              <span
                className="text-[10px] uppercase tracking-widest font-bold inline-flex items-center gap-1.5"
                style={{ color: aiSummary.ai ? BSL.cyan : BSL.muted }}
              >
                <Sparkles className="h-3 w-3" />{" "}
                {aiSummary.ai ? "AI generated" : "Auto summary"}
              </span>
            }
          >
            <div className="py-1">
              {aiSummary.headline && (
                <h3
                  className="text-xl md:text-2xl font-black tracking-tight mb-2"
                  style={{
                    color: BSL.gold,
                    textShadow: `0 0 18px ${BSL.gold}44`,
                  }}
                  data-testid="ai-summary-headline"
                >
                  {aiSummary.headline}
                </h3>
              )}
              <p
                className="text-sm md:text-base leading-relaxed"
                style={{ color: "hsla(0,0%,100%,0.82)" }}
                data-testid="ai-summary-text"
              >
                {aiSummary.text}
              </p>
              <div
                className="mt-3 text-[10px] uppercase tracking-widest"
                style={{ color: BSL.faint }}
              >
                Updated after {aiSummary.basedOnFinished} finished{" "}
                {aiSummary.basedOnFinished === 1 ? "match" : "matches"}
              </div>
            </div>
          </GlowPanel>
        </div>
      )}

      {/* CLUB POWER RANKINGS + LATEST RESULTS */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 mt-10 grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlowPanel
          title="Club Power Rankings"
          subtitle="Every club, ranked by points"
          tone="gold"
          icon={<Trophy className="h-4 w-4" />}
        >
          {clubLeaderboard.length === 0 ? (
            <div
              className="py-10 text-center text-sm"
              style={{ color: BSL.muted }}
            >
              Rankings appear once clubs start playing.
            </div>
          ) : (
            <div className="space-y-2">
              {clubLeaderboard.map((c: any) => {
                const top3 = c.position <= 3;
                const medal =
                  c.position === 1
                    ? BSL.gold
                    : c.position === 2
                      ? "hsl(0,0%,75%)"
                      : c.position === 3
                        ? BSL.bronze
                        : BSL.muted;
                return (
                  <button
                    type="button"
                    key={c.clubId}
                    onClick={() =>
                      setStatsClub({
                        id: c.clubId,
                        name: c.clubName,
                        division: c.division,
                        logoUrl: c.clubLogo,
                      })
                    }
                    className="w-full text-left flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition hover:scale-[1.01]"
                    style={{
                      background: top3 ? `${medal}12` : "hsla(0,0%,100%,0.03)",
                      border: `1px solid ${top3 ? `${medal}44` : BSL.border}`,
                    }}
                    data-testid={`power-rank-${c.clubId}`}
                  >
                    <div
                      className="w-7 text-center text-lg font-black tabular-nums shrink-0"
                      style={{ color: medal }}
                    >
                      {c.position}
                    </div>
                    <div
                      className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center text-xs font-black shrink-0"
                      style={{ background: `${BSL.gold}1a`, color: BSL.gold }}
                    >
                      {c.clubLogo ? (
                        <img
                          src={c.clubLogo}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        c.clubName.slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold truncate">
                        {c.clubName}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.faint }}
                      >
                        {c.played}P · {c.won}W · {c.lost}L
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className="text-xl font-black tabular-nums"
                        style={{ color: BSL.gold }}
                      >
                        {c.points}
                      </div>
                      <div
                        className="text-[9px] uppercase tracking-widest"
                        style={{ color: BSL.faint }}
                      >
                        pts
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </GlowPanel>

        <GlowPanel
          title="Latest Results"
          subtitle="Recently finished matches"
          tone="cyan"
          icon={<History className="h-4 w-4" />}
        >
          {!Array.isArray(finishedFixtures) || finishedFixtures.length === 0 ? (
            <div
              className="py-10 text-center text-sm"
              style={{ color: BSL.muted }}
            >
              No finished matches yet — results land here as soon as scores are
              confirmed.
            </div>
          ) : (
            <div className="space-y-2">
              {finishedFixtures
                .slice()
                .sort(
                  (a: any, b: any) =>
                    new Date(b.startTime || 0).getTime() -
                    new Date(a.startTime || 0).getTime(),
                )
                .slice(0, 8)
                .map((f: any) => {
                  const homeWon = f.homePoints > f.awayPoints;
                  const awayWon = f.awayPoints > f.homePoints;
                  const canH2H =
                    f.homeClubId != null &&
                    f.awayClubId != null &&
                    f.homeClubId !== f.awayClubId;
                  return (
                    <div
                      key={f.id}
                      className="rounded-xl px-3 py-2.5"
                      style={{
                        background: "hsla(0,0%,100%,0.03)",
                        border: `1px solid ${BSL.border}`,
                      }}
                      data-testid={`latest-result-${f.id}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex-1 min-w-0 flex items-center gap-2">
                          <div
                            className="h-7 w-7 rounded-md overflow-hidden flex items-center justify-center text-[10px] font-black shrink-0"
                            style={{
                              background: `${BSL.gold}1a`,
                              color: BSL.gold,
                            }}
                          >
                            {f.homeClubLogo ? (
                              <img
                                src={f.homeClubLogo}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (f.homeClubName || f.homeTeamName || "?")
                                .slice(0, 2)
                                .toUpperCase()
                            )}
                          </div>
                          <span
                            className="text-sm font-semibold truncate"
                            style={{ color: homeWon ? BSL.text : BSL.muted }}
                          >
                            {f.homeClubName || f.homeTeamName || "TBD"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 tabular-nums shrink-0">
                          <span
                            className="text-base font-black"
                            style={{ color: homeWon ? BSL.gold : BSL.muted }}
                          >
                            {f.homePoints}
                          </span>
                          <span
                            className="text-xs"
                            style={{ color: BSL.faint }}
                          >
                            –
                          </span>
                          <span
                            className="text-base font-black"
                            style={{ color: awayWon ? BSL.gold : BSL.muted }}
                          >
                            {f.awayPoints}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-2 justify-end">
                          <span
                            className="text-sm font-semibold truncate text-right"
                            style={{ color: awayWon ? BSL.text : BSL.muted }}
                          >
                            {f.awayClubName || f.awayTeamName || "TBD"}
                          </span>
                          <div
                            className="h-7 w-7 rounded-md overflow-hidden flex items-center justify-center text-[10px] font-black shrink-0"
                            style={{
                              background: `${BSL.cyan}1a`,
                              color: BSL.cyan,
                            }}
                          >
                            {f.awayClubLogo ? (
                              <img
                                src={f.awayClubLogo}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              (f.awayClubName || f.awayTeamName || "?")
                                .slice(0, 2)
                                .toUpperCase()
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span
                          className="text-[10px] uppercase tracking-widest"
                          style={{ color: BSL.faint }}
                        >
                          {f.startTime
                            ? new Date(f.startTime).toLocaleDateString(
                                "en-GB",
                                { day: "numeric", month: "short" },
                              )
                            : ""}{" "}
                          · {f.homePoints}-{f.awayPoints} pts
                        </span>
                        {canH2H && (
                          <button
                            type="button"
                            onClick={() =>
                              setH2h({ a: f.homeClubId, b: f.awayClubId })
                            }
                            className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold cursor-pointer transition hover:brightness-125"
                            style={{ color: BSL.cyan }}
                            data-testid={`button-h2h-${f.id}`}
                          >
                            <Swords className="h-3 w-3" /> Head to Head
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </GlowPanel>
      </div>

      {/* MAIN GRID */}
      <div className="max-w-[1600px] mx-auto px-4 md:px-8 mt-10 grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* LIVE & UPCOMING (2/3) */}
        <div className="lg:col-span-2 space-y-5">
          <GlowPanel
            title="Live Now"
            subtitle="Matches in progress"
            tone="gold"
            icon={<Activity className="h-4 w-4" />}
            action={
              <span
                className="text-[11px] uppercase tracking-widest font-bold"
                style={{ color: BSL.danger }}
              >
                ● {liveFixtures.length} live
              </span>
            }
          >
            {liveFixtures.length === 0 ? (
              <div
                className="py-10 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                No matches in progress. Check back on league day.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {liveFixtures.map((f) => (
                  <MatchCard key={f.id} {...f} />
                ))}
              </div>
            )}
          </GlowPanel>

          <GlowPanel
            title="Upcoming Fixtures"
            subtitle="Scheduled for the next league day"
            tone="cyan"
            icon={<Calendar className="h-4 w-4" />}
          >
            {upcomingFixtures.length === 0 ? (
              <div
                className="py-10 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                Fixtures will appear here once the admin generates them.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {upcomingFixtures.slice(0, 6).map((f) => (
                  <MatchCard key={f.id} {...f} />
                ))}
              </div>
            )}
          </GlowPanel>

          <GlowPanel
            title="Registered Clubs"
            subtitle="Approved clubs in this season"
            tone="gold"
            icon={<Shield className="h-4 w-4" />}
            action={
              <Link
                href="/register-club"
                className="text-[11px] uppercase tracking-widest font-bold inline-flex items-center gap-1"
                style={{ color: BSL.gold }}
              >
                Register <ChevronRight className="h-3 w-3" />
              </Link>
            }
          >
            {clubs.filter((c) => c.status === "ACTIVE").length === 0 ? (
              <div
                className="py-10 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                No clubs approved yet. Be the first to register.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {clubs
                  .filter((c) => c.status === "ACTIVE")
                  .map((c) => (
                    <motion.button
                      type="button"
                      key={c.id}
                      whileHover={{ y: -2, scale: 1.02 }}
                      onClick={() => setStatsClub(c)}
                      className="rounded-xl p-3 flex items-center gap-3 text-left w-full cursor-pointer"
                      style={{
                        background: "hsla(0,0%,100%,0.04)",
                        border: `1px solid hsla(0,0%,100%,0.08)`,
                      }}
                      data-testid={`club-tile-${c.id}`}
                    >
                      <div
                        className="h-9 w-9 rounded-lg overflow-hidden flex items-center justify-center text-xs font-black"
                        style={{ background: `${BSL.gold}22`, color: BSL.gold }}
                      >
                        {c.logoUrl ? (
                          <img
                            src={c.logoUrl}
                            className="h-full w-full object-cover"
                            alt={c.name}
                          />
                        ) : (
                          c.name.slice(0, 2).toUpperCase()
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate flex items-center gap-1.5">
                          {c.name}
                          {c.sleepingAt && (
                            <span
                              className="inline-flex items-center text-[9px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded"
                              style={{
                                background: "hsla(220,40%,60%,0.18)",
                                color: "hsl(220,80%,75%)",
                              }}
                              title="This club is sleeping — data preserved"
                              data-testid={`badge-sleeping-tile-${c.id}`}
                            >
                              Sleeping
                            </span>
                          )}
                        </div>
                        <div
                          className="text-[10px] uppercase tracking-widest"
                          style={{ color: BSL.cyan }}
                        >
                          {c.division}
                        </div>
                      </div>
                    </motion.button>
                  ))}
              </div>
            )}
          </GlowPanel>
        </div>

        {/* RIGHT COL */}
        <div className="space-y-5">
          <GlowPanel
            title="Standings"
            subtitle="League table"
            tone="gold"
            icon={<Trophy className="h-4 w-4" />}
          >
            {standings.length === 0 ? (
              <div
                className="py-10 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                Standings build up after the first league day.
              </div>
            ) : (
              <div className="space-y-1">
                {standings.slice(0, 8).map((t: any) => (
                  <LeaderRow
                    key={t.id}
                    position={t.position}
                    name={t.name}
                    sub={`${t.clubName} · ${t.division}`}
                    logo={t.clubLogo}
                    played={t.played}
                    won={t.won}
                    drawn={t.drawn}
                    lost={t.lost}
                    points={t.points}
                    rubberDiff={t.rubberDiff}
                  />
                ))}
              </div>
            )}
          </GlowPanel>

          <GlowPanel
            title="Top Performers"
            subtitle="Most-winning players"
            tone="cyan"
            icon={<Sparkles className="h-4 w-4" />}
          >
            {mvp.length === 0 ? (
              <div
                className="py-8 text-center text-sm"
                style={{ color: BSL.muted }}
              >
                Player stats appear once matches are played.
              </div>
            ) : (
              <div className="space-y-2">
                {mvp.map((p: any, i: number) => (
                  <button
                    type="button"
                    key={p.id}
                    onClick={() =>
                      setBattlecardPlayer({
                        id: p.id,
                        name: p.displayName || `Player #${p.id}`,
                      })
                    }
                    className="w-full text-left flex items-center gap-3 px-2 py-2 rounded-lg cursor-pointer transition hover:scale-[1.01]"
                    style={{
                      background: i === 0 ? `${BSL.cyan}10` : "transparent",
                    }}
                    data-testid={`mvp-row-${p.id}`}
                  >
                    <div
                      className="text-sm font-black w-6 text-center"
                      style={{ color: i === 0 ? BSL.cyan : BSL.muted }}
                    >
                      #{i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-sm font-semibold truncate"
                        data-testid={`mvp-name-${p.id}`}
                      >
                        {p.displayName || `Player #${p.id}`}
                      </div>
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.muted }}
                      >
                        {p.matchesWon}W · {p.matchesPlayed}P
                      </div>
                    </div>
                    <div
                      className="text-base font-black tabular-nums"
                      style={{ color: BSL.gold }}
                    >
                      {p.pointsScored}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </GlowPanel>

          <GlowPanel
            title="One City. One Venue."
            subtitle="The format"
            tone="gold"
            icon={<MapPin className="h-4 w-4" />}
          >
            <div className="space-y-3 text-sm" style={{ color: BSL.muted }}>
              <div className="flex justify-between">
                <span>Venue</span>
                <span style={{ color: BSL.text }} className="font-semibold">
                  {league?.venueName?.split(",")[0] || "TBD"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Format</span>
                <span style={{ color: BSL.text }} className="font-semibold">
                  6 Matches / Tie
                </span>
              </div>
              <div className="flex justify-between">
                <span>Schedule</span>
                <span style={{ color: BSL.text }} className="font-semibold">
                  1 Saturday / Month
                </span>
              </div>
              <div className="flex justify-between">
                <span>Season</span>
                <span style={{ color: BSL.text }} className="font-semibold">
                  12 League Days
                </span>
              </div>
              <div className="flex justify-between">
                <span>Club Fee</span>
                <span style={{ color: BSL.gold }} className="font-bold">
                  £{((league?.clubFee || 0) / 100).toFixed(0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Player Fee</span>
                <span style={{ color: BSL.gold }} className="font-bold">
                  £{((league?.playerFee || 0) / 100).toFixed(0)}
                </span>
              </div>
            </div>
          </GlowPanel>
        </div>
      </div>
    </div>
  );
}
