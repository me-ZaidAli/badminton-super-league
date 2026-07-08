import { useEffect, useMemo, useState } from "react";
import { Link } from "@/lib/routing";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Swords,
  Trophy,
  Users,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  MapPin,
  Send,
  Check,
  X,
  Hourglass,
  CheckCircle2,
  AlertCircle,
  Crown,
} from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { BslSubNav } from "@/components/BslSubNav";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";

type ClubRow = {
  id: number;
  name: string;
  logoUrl: string | null;
  division: string;
  additionalDivisions: string[];
  managerUserId: number;
  adminUserIds: number[];
  rank: number | null;
  played: number;
  won: number;
  lost: number;
  drawn: number;
  points: number;
  rubberDiff: number;
  teamCount: number;
  iAmMember: boolean;
  canActFor: boolean;
  teams: Array<{
    id: number;
    name: string;
    division: string;
    category: string | null;
    pairNumber: number | null;
    members: Array<{ playerId: number; name: string }>;
  }>;
};
type MatchDay = {
  id: number;
  date: string;
  state: string;
  status: string;
  venue: string | null;
  notes: string | null;
  division: string | null;
  category: string | null;
  maxMatches: number | null;
  slotsUsed: number;
  slotsRemaining: number | null;
};
type Challenge = {
  id: number;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "CANCELLED" | "COMPLETED";
  challengerClubId: number;
  opponentClubId: number;
  leagueDayId: number;
  numMatches: number;
  message: string | null;
  createdAt: string;
  challengerClub: { id: number; name: string; logoUrl: string | null } | null;
  opponentClub: { id: number; name: string; logoUrl: string | null } | null;
  leagueDay: { id: number; date: string; venue: string | null } | null;
};

const fmtDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export default function ChallengeZone() {
  const { data: user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"clubs" | "challenges">("clubs");
  const [sortBy, setSortBy] = useState<"rank" | "name" | "teams">("rank");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [challengeTarget, setChallengeTarget] = useState<ClubRow | null>(null);

  const { data: clubs = [], isLoading: clubsLoading } = useQuery<ClubRow[]>({
    queryKey: ["/api/bsl/challenge-zone/clubs"],
  });
  const { data: matchDays = [] } = useQuery<MatchDay[]>({
    queryKey: ["/api/bsl/challenge-zone/match-days"],
  });
  const { data: challenges = [] } = useQuery<Challenge[]>({
    queryKey: ["/api/bsl/challenges"],
  });

  const isPlatformAdmin = user?.role === "OWNER" || user?.role === "ADMIN";

  // Real-membership clubs (server-authoritative `iAmMember` — manager, club
  // admin, captain, or registered player). This drives the "YOURS" badge and
  // defaults the challenger picker. Platform admins do NOT inherit membership.
  const memberClubs = useMemo(() => clubs.filter((c) => c.iAmMember), [clubs]);
  // Clubs the user is allowed to act on behalf of. Platform admins can act
  // for any club (brokered admin challenges); regular users only for their own.
  const myClubs = useMemo(
    () => (isPlatformAdmin ? clubs : memberClubs),
    [clubs, memberClubs, isPlatformAdmin],
  );
  const memberClubIds = useMemo(
    () => new Set(memberClubs.map((c) => c.id)),
    [memberClubs],
  );

  const canChallenge = myClubs.length > 0;

  const filteredClubs = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = clubs.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.division.toLowerCase().includes(q),
    );
    if (sortBy === "rank")
      rows = [...rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
    else if (sortBy === "name")
      rows = [...rows].sort((a, b) => a.name.localeCompare(b.name));
    else rows = [...rows].sort((a, b) => b.teamCount - a.teamCount);
    return rows;
  }, [clubs, search, sortBy]);

  // Incoming/outgoing buckets use REAL membership so a platform admin's
  // own club challenges land in their own inbox — brokered challenges they
  // create for other clubs surface in League activity.
  const incoming = challenges.filter(
    (c) => memberClubIds.has(c.opponentClubId) && c.status === "PENDING",
  );
  const outgoing = challenges.filter((c) =>
    memberClubIds.has(c.challengerClubId),
  );
  const otherChallenges = challenges.filter(
    (c) =>
      !memberClubIds.has(c.opponentClubId) &&
      !memberClubIds.has(c.challengerClubId),
  );
  // Acting set — wider than membership for platform admins (lets them
  // accept/decline/cancel on behalf of any club from the Challenges tab).
  const actableClubIds = useMemo(
    () => new Set(myClubs.map((c) => c.id)),
    [myClubs],
  );

  // Battle-box drag state — each box represents a Match Day with 2 slots.
  // Drop a club card onto a slot to place it there. Filling both slots opens
  // the challenge dialog pre-populated with that pair + that match day.
  const [boxes, setBoxes] = useState<
    Record<number, { home: ClubRow | null; away: ClubRow | null }>
  >({});
  const [dragClub, setDragClub] = useState<ClubRow | null>(null);
  const placeClub = (dayId: number, slot: "home" | "away", club: ClubRow) => {
    setBoxes((prev) => {
      const cur = prev[dayId] || { home: null, away: null };
      const other = slot === "home" ? cur.away : cur.home;
      if (other && other.id === club.id) return prev; // can't place same club in both slots
      return { ...prev, [dayId]: { ...cur, [slot]: club } };
    });
  };
  const clearSlot = (dayId: number, slot: "home" | "away") => {
    setBoxes((prev) => ({
      ...prev,
      [dayId]: { ...(prev[dayId] || { home: null, away: null }), [slot]: null },
    }));
  };
  const launchBoxChallenge = (dayId: number) => {
    const box = boxes[dayId];
    if (!box?.home || !box?.away) return;
    // Pick challenger: prefer user's real-membership side; else first of
    // canActFor; admins broker either way.
    const home = box.home,
      away = box.away;
    const challenger = home.iAmMember
      ? home
      : away.iAmMember
        ? away
        : home.canActFor
          ? home
          : away;
    const target = challenger.id === home.id ? away : home;
    setChallengeTarget(target);
    setBoxPreselect({ challengerId: challenger.id, leagueDayId: dayId });
  };
  const [boxPreselect, setBoxPreselect] = useState<{
    challengerId: number;
    leagueDayId: number;
  } | null>(null);

  const respond = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: string }) =>
      apiRequest("PATCH", `/api/bsl/challenges/${id}`, { action }),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/challenges"] });
      qc.invalidateQueries({
        queryKey: ["/api/bsl/challenge-zone/match-days"],
      });
      toast({ title: `Challenge ${vars.action}ed` });
    },
    onError: (e: any) =>
      toast({
        title: "Error",
        description: e.message || "Action failed",
        variant: "destructive",
      }),
  });

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <BslSubNav />
      <div className="max-w-6xl mx-auto px-4 py-6 sm:py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/">
            <a
              className="inline-flex items-center gap-2 text-sm"
              style={{ color: BSL.muted }}
              data-testid="link-back-bsl"
            >
              <ArrowLeft className="h-4 w-4" /> Back to BSL
            </a>
          </Link>
          {canChallenge && (
            <span
              className="text-xs px-3 py-1 rounded-full font-bold uppercase tracking-widest"
              style={{
                background: `${BSL.cyan}22`,
                color: BSL.cyan,
                border: `1px solid ${BSL.cyan}55`,
              }}
            >
              You can send challenges
            </span>
          )}
        </div>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <div
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{
              background: `${BSL.cyan}1a`,
              border: `1px solid ${BSL.cyan}55`,
              boxShadow: `0 0 40px ${BSL.cyan}55`,
            }}
          >
            <Swords className="h-8 w-8" style={{ color: BSL.cyan }} />
          </div>
          <h1
            className="text-3xl sm:text-5xl font-black tracking-tight"
            style={{ color: BSL.text, textShadow: `0 0 30px ${BSL.cyan}99` }}
          >
            Challenge <span style={{ color: BSL.gold }}>Zone</span>
          </h1>
          <p
            className="mt-3 max-w-2xl mx-auto text-sm sm:text-base"
            style={{ color: BSL.muted }}
          >
            See every club in the league, study their squads, then call them out
            on an official Match Day. May the best paddle win.
          </p>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          {(["clubs", "challenges"] as const).map((t) => {
            const active = tab === t;
            const label =
              t === "clubs"
                ? `Clubs (${clubs.length})`
                : `Challenges (${challenges.length})`;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                data-testid={`tab-${t}`}
                className="px-4 py-2 rounded-xl text-sm font-bold uppercase tracking-widest transition"
                style={{
                  background: active ? `${BSL.cyan}22` : `${BSL.card}`,
                  color: active ? BSL.cyan : BSL.muted,
                  border: `1px solid ${active ? BSL.cyan : BSL.border}`,
                  boxShadow: active ? `0 0 20px ${BSL.cyan}55` : "none",
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === "clubs" ? (
          <>
            {/* Controls */}
            <GlowPanel className="mb-6 p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1 relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
                    style={{ color: BSL.muted }}
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search clubs or divisions…"
                    data-testid="input-search-clubs"
                    className="w-full pl-10 pr-3 py-2 rounded-lg text-sm"
                    style={{
                      background: BSL.bgDeep,
                      color: BSL.text,
                      border: `1px solid ${BSL.border}`,
                    }}
                  />
                </div>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  data-testid="select-sort"
                  className="px-3 py-2 rounded-lg text-sm font-semibold"
                  style={{
                    background: BSL.bgDeep,
                    color: BSL.text,
                    border: `1px solid ${BSL.border}`,
                  }}
                >
                  <option value="rank">Sort: League rank</option>
                  <option value="name">Sort: Name</option>
                  <option value="teams">Sort: Most teams</option>
                </select>
              </div>
            </GlowPanel>

            {/* Clubs grid */}
            {clubsLoading ? (
              <div className="text-center py-12" style={{ color: BSL.muted }}>
                Loading clubs…
              </div>
            ) : filteredClubs.length === 0 ? (
              <div className="text-center py-12" style={{ color: BSL.muted }}>
                No clubs match your search.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <AnimatePresence>
                  {filteredClubs.map((c) => (
                    <ClubCard
                      key={c.id}
                      club={c}
                      expanded={expanded === c.id}
                      onToggle={() =>
                        setExpanded(expanded === c.id ? null : c.id)
                      }
                      onChallenge={() => {
                        setBoxPreselect(null);
                        setChallengeTarget(c);
                      }}
                      onDragStart={() => setDragClub(c)}
                      onDragEnd={() => setDragClub(null)}
                      canChallenge={canChallenge && !c.iAmMember}
                      isMine={c.iAmMember}
                      isPlatformAdmin={isPlatformAdmin}
                      isAdminBroker={isPlatformAdmin && !c.iAmMember}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        ) : (
          <>
            {/* My challenges + global feed */}
            {!user ? (
              <div className="text-center py-12" style={{ color: BSL.muted }}>
                Sign in to see your challenges.
              </div>
            ) : (
              <div className="space-y-6">
                {(incoming.length > 0 || outgoing.length > 0) && (
                  <>
                    {incoming.length > 0 && (
                      <ChallengeList
                        title="Incoming · waiting for your response"
                        tone="cyan"
                        rows={incoming}
                        canRespond
                        user={user as any}
                        onAction={(id, action) =>
                          respond.mutate({ id, action })
                        }
                        myClubIds={actableClubIds}
                        matchDays={matchDays}
                      />
                    )}
                    {outgoing.length > 0 && (
                      <ChallengeList
                        title="Sent by your clubs"
                        tone="gold"
                        rows={outgoing}
                        canRespond
                        user={user as any}
                        onAction={(id, action) =>
                          respond.mutate({ id, action })
                        }
                        myClubIds={actableClubIds}
                        matchDays={matchDays}
                      />
                    )}
                  </>
                )}
                {otherChallenges.length > 0 && (
                  <ChallengeList
                    title="League activity"
                    tone="muted"
                    rows={otherChallenges}
                    canRespond={isPlatformAdmin}
                    user={user as any}
                    onAction={(id, action) => respond.mutate({ id, action })}
                    myClubIds={actableClubIds}
                    matchDays={matchDays}
                  />
                )}
                {challenges.length === 0 && (
                  <div
                    className="text-center py-12"
                    style={{ color: BSL.muted }}
                  >
                    No challenges yet. Head to the Clubs tab and pick a target.
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Sticky Battle Box drag-and-drop strip */}
      {canChallenge && matchDays.length > 0 && tab === "clubs" && (
        <BattleBoxStrip
          matchDays={matchDays}
          boxes={boxes}
          dragClub={dragClub}
          onDrop={placeClub}
          onClear={clearSlot}
          onLaunch={launchBoxChallenge}
          myClubs={memberClubs}
          isPlatformAdmin={isPlatformAdmin}
        />
      )}

      <AnimatePresence>
        {challengeTarget && (
          <ChallengeDialog
            target={challengeTarget}
            myClubs={myClubs}
            matchDays={matchDays}
            preselect={boxPreselect}
            onClose={() => {
              setChallengeTarget(null);
              setBoxPreselect(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function BattleBoxStrip({
  matchDays,
  boxes,
  dragClub,
  onDrop,
  onClear,
  onLaunch,
  myClubs,
  isPlatformAdmin,
}: {
  matchDays: MatchDay[];
  boxes: Record<number, { home: ClubRow | null; away: ClubRow | null }>;
  dragClub: ClubRow | null;
  onDrop: (dayId: number, slot: "home" | "away", club: ClubRow) => void;
  onClear: (dayId: number, slot: "home" | "away") => void;
  onLaunch: (dayId: number) => void;
  myClubs: ClubRow[];
  isPlatformAdmin: boolean;
}) {
  const usableDays = matchDays
    .filter((d) => d.slotsRemaining == null || d.slotsRemaining > 0)
    .slice(0, 6);

  // Non-admin owners: home slot is auto-locked to ONE of the user's own
  // clubs so they can NEVER drop "any club" into their side — they can
  // only drag an opponent into the away slot. Platform admins keep full
  // broker freedom (no auto-lock).
  //
  // If the user belongs to multiple clubs they pick which one fights via
  // the small chip selector in the header (`selectedHomeId`). Default = the
  // first club the API returned (server-side ordering).
  const [selectedHomeId, setSelectedHomeId] = useState<number | null>(null);
  const lockedHomeClub = useMemo(() => {
    if (isPlatformAdmin || myClubs.length === 0) return null;
    return myClubs.find((c) => c.id === selectedHomeId) ?? myClubs[0];
  }, [isPlatformAdmin, myClubs, selectedHomeId]);

  useEffect(() => {
    if (!lockedHomeClub) return;
    for (const d of usableDays) {
      const cur = boxes[d.id]?.home;
      if (!cur || cur.id !== lockedHomeClub.id) {
        onDrop(d.id, "home", lockedHomeClub);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockedHomeClub?.id, usableDays.map((d) => d.id).join(",")]);

  if (usableDays.length === 0) return null;
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 pointer-events-none">
      <div className="max-w-6xl mx-auto px-4 pb-4 pointer-events-auto">
        <motion.div
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 24 }}
          className="rounded-3xl p-5"
          style={{
            background: `linear-gradient(180deg, ${BSL.card}f5 0%, ${BSL.bgDeep}f8 100%)`,
            border: `2px solid ${BSL.cyan}66`,
            boxShadow: `0 -12px 60px ${BSL.bgDeep}cc, 0 0 50px ${BSL.cyan}44, inset 0 1px 0 ${BSL.cyan}22`,
            backdropFilter: "blur(14px)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4 px-1">
            <div className="flex items-center gap-2.5">
              <motion.div
                animate={{ rotate: [0, -8, 8, -8, 0] }}
                transition={{
                  duration: 2.4,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="flex items-center justify-center w-9 h-9 rounded-xl"
                style={{
                  background: `linear-gradient(135deg, ${BSL.cyan}33, ${BSL.gold}33)`,
                  border: `1px solid ${BSL.cyan}66`,
                  boxShadow: `0 0 18px ${BSL.cyan}66`,
                }}
              >
                <Swords className="h-5 w-5" style={{ color: BSL.gold }} />
              </motion.div>
              <div>
                <div
                  className="text-sm uppercase tracking-widest font-black"
                  style={{
                    color: BSL.cyan,
                    textShadow: `0 0 12px ${BSL.cyan}88`,
                  }}
                >
                  Battle Box
                </div>
                <div
                  className="text-[11px] font-semibold"
                  style={{ color: BSL.muted }}
                >
                  {lockedHomeClub
                    ? `Your club is locked in — drag any opponent into the empty slot`
                    : "Drag two clubs into a Match Day to start a brokered challenge"}
                </div>
                {/* Multi-club picker — only shows when the user belongs to
                    more than one club. Lets them swap which of their clubs
                    is locked into the home slot for every Match Day. */}
                {lockedHomeClub && myClubs.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                    <span
                      className="text-[9px] uppercase tracking-widest font-bold"
                      style={{ color: BSL.faint }}
                    >
                      Fight as:
                    </span>
                    {myClubs.map((c) => {
                      const active = c.id === lockedHomeClub.id;
                      return (
                        <button
                          key={c.id}
                          onClick={() => setSelectedHomeId(c.id)}
                          data-testid={`button-fight-as-${c.id}`}
                          className="text-[10px] px-2 py-0.5 rounded-full font-bold transition"
                          style={{
                            background: active
                              ? `${BSL.gold}33`
                              : `${BSL.card}`,
                            color: active ? BSL.gold : BSL.muted,
                            border: `1px solid ${active ? BSL.gold : BSL.border}`,
                            boxShadow: active
                              ? `0 0 10px ${BSL.gold}55`
                              : "none",
                          }}
                        >
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            {dragClub && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[11px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full"
                style={{
                  background: `${BSL.gold}22`,
                  color: BSL.gold,
                  border: `1px solid ${BSL.gold}66`,
                }}
              >
                ⚡ Dragging {dragClub.name}
              </motion.div>
            )}
          </div>

          {/* Cards */}
          <div className="flex gap-3 overflow-x-auto pb-1">
            {usableDays.map((d) => {
              const box = boxes[d.id] || { home: null, away: null };
              const ready = !!(box.home && box.away);
              const homeLocked =
                !!lockedHomeClub && box.home?.id === lockedHomeClub.id;
              return (
                <motion.div
                  key={d.id}
                  whileHover={{ y: -2 }}
                  className="flex-shrink-0 rounded-2xl p-3 relative overflow-hidden"
                  style={{
                    background: `linear-gradient(160deg, ${BSL.bgDeep} 0%, ${BSL.card} 100%)`,
                    border: `1.5px solid ${ready ? BSL.gold : BSL.border}`,
                    minWidth: 360,
                    boxShadow: ready
                      ? `0 0 40px ${BSL.gold}77, 0 0 18px ${BSL.cyan}44 inset`
                      : `0 4px 22px ${BSL.bgDeep}aa`,
                  }}
                  data-testid={`battlebox-${d.id}`}
                >
                  {/* Ready spark sweep */}
                  {ready && (
                    <motion.div
                      aria-hidden
                      initial={{ x: "-100%" }}
                      animate={{ x: "200%" }}
                      transition={{
                        duration: 2.2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="absolute inset-y-0 w-24 pointer-events-none"
                      style={{
                        background: `linear-gradient(90deg, transparent, ${BSL.gold}33, transparent)`,
                        filter: "blur(6px)",
                      }}
                    />
                  )}

                  <div className="flex items-center justify-between mb-2 px-0.5 relative z-10">
                    <div
                      className="text-[11px] font-black uppercase tracking-widest"
                      style={{ color: BSL.cyan }}
                    >
                      <Calendar className="inline h-3 w-3 mr-1 -mt-0.5" />
                      {new Date(d.date).toLocaleDateString("en-GB", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                    {d.slotsRemaining != null && (
                      <div
                        className="text-[10px] font-bold"
                        style={{ color: BSL.faint }}
                      >
                        {d.slotsRemaining} slots left
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 relative z-10">
                    <DropSlot
                      box={box.home}
                      slot="home"
                      dayId={d.id}
                      onDrop={onDrop}
                      onClear={onClear}
                      dragClub={dragClub}
                      locked={homeLocked}
                      label={homeLocked ? "Your Club" : "Home"}
                    />

                    {/* Animated crossed-swords VS */}
                    <div
                      className="flex flex-col items-center justify-center px-1 relative"
                      style={{ minWidth: 36 }}
                    >
                      <motion.div
                        animate={
                          ready
                            ? { scale: [1, 1.18, 1], rotate: [0, 6, -6, 0] }
                            : { scale: [1, 1.05, 1] }
                        }
                        transition={{
                          duration: ready ? 0.9 : 1.6,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                        className="relative"
                      >
                        <Swords
                          className="h-6 w-6"
                          style={{
                            color: ready ? BSL.gold : BSL.cyan,
                            filter: `drop-shadow(0 0 8px ${ready ? BSL.gold : BSL.cyan}aa)`,
                          }}
                        />
                        {ready && (
                          <>
                            {/* Spark bursts on ready */}
                            {[0, 1, 2, 3].map((i) => (
                              <motion.span
                                key={i}
                                aria-hidden
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{
                                  opacity: [0, 1, 0],
                                  scale: [0, 1.4, 0],
                                }}
                                transition={{
                                  duration: 1.2,
                                  repeat: Infinity,
                                  delay: i * 0.3,
                                }}
                                className="absolute top-1/2 left-1/2 w-1 h-1 rounded-full -ml-0.5 -mt-0.5"
                                style={{
                                  background: BSL.gold,
                                  boxShadow: `0 0 6px ${BSL.gold}`,
                                  transform: `translate(${[10, -10, 10, -10][i]}px, ${[10, 10, -10, -10][i]}px)`,
                                }}
                              />
                            ))}
                          </>
                        )}
                      </motion.div>
                      <div
                        className="text-[9px] font-black mt-0.5"
                        style={{ color: ready ? BSL.gold : BSL.muted }}
                      >
                        VS
                      </div>
                    </div>

                    <DropSlot
                      box={box.away}
                      slot="away"
                      dayId={d.id}
                      onDrop={onDrop}
                      onClear={onClear}
                      dragClub={dragClub}
                      locked={false}
                      label="Opponent"
                    />
                  </div>

                  <motion.button
                    disabled={!ready}
                    onClick={() => onLaunch(d.id)}
                    whileTap={ready ? { scale: 0.97 } : undefined}
                    whileHover={ready ? { scale: 1.02 } : undefined}
                    data-testid={`button-launch-${d.id}`}
                    className="mt-3 w-full px-3 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition disabled:opacity-40 disabled:cursor-not-allowed relative z-10 flex items-center justify-center gap-2"
                    style={{
                      background: ready
                        ? `linear-gradient(90deg, ${BSL.cyan}, ${BSL.gold})`
                        : BSL.card,
                      color: ready ? "#000" : BSL.faint,
                      border: `1.5px solid ${ready ? BSL.gold : BSL.border}`,
                      boxShadow: ready
                        ? `0 0 26px ${BSL.gold}aa, 0 4px 16px ${BSL.cyan}55`
                        : "none",
                      textShadow: ready ? `0 1px 0 ${BSL.gold}66` : "none",
                    }}
                  >
                    {ready ? (
                      <>
                        <Swords className="h-4 w-4" />
                        Launch Challenge
                        <Swords className="h-4 w-4 scale-x-[-1]" />
                      </>
                    ) : (
                      <>Drop an opponent to fight</>
                    )}
                  </motion.button>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function DropSlot({
  box,
  slot,
  dayId,
  onDrop,
  onClear,
  dragClub,
  locked,
  label,
}: {
  box: ClubRow | null;
  slot: "home" | "away";
  dayId: number;
  onDrop: (dayId: number, slot: "home" | "away", club: ClubRow) => void;
  onClear: (dayId: number, slot: "home" | "away") => void;
  dragClub: ClubRow | null;
  locked: boolean;
  label: string;
}) {
  const [over, setOver] = useState(false);
  const dragging = !!dragClub;
  const filled = !!box;
  const accent = locked ? BSL.gold : BSL.cyan;
  return (
    <motion.div
      animate={over && !locked ? { scale: 1.04 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      onDragOver={(e) => {
        if (locked) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (locked) return;
        e.preventDefault();
        setOver(false);
        const raw = e.dataTransfer.getData("text/club-id");
        if (!raw || !dragClub) return;
        if (dragClub.id === Number(raw)) onDrop(dayId, slot, dragClub);
      }}
      onClick={() => !locked && box && onClear(dayId, slot)}
      title={
        locked
          ? "Your club — locked in"
          : box
            ? "Click to remove"
            : "Drop a club here"
      }
      data-testid={`dropslot-${dayId}-${slot}`}
      className="flex-1 rounded-xl flex flex-col items-center justify-center gap-1 text-center transition relative overflow-hidden"
      style={{
        minHeight: 78,
        padding: "8px 6px",
        background: filled
          ? `linear-gradient(160deg, ${accent}22, ${accent}08)`
          : over
            ? `${BSL.cyan}25`
            : dragging
              ? `${BSL.cyan}10`
              : BSL.card,
        border: `1.5px ${filled ? "solid" : "dashed"} ${
          filled
            ? accent
            : over
              ? BSL.cyan
              : dragging
                ? `${BSL.cyan}aa`
                : BSL.border
        }`,
        cursor: locked
          ? "default"
          : filled
            ? "pointer"
            : dragging
              ? "copy"
              : "default",
        boxShadow: filled
          ? `0 0 18px ${accent}55, inset 0 0 12px ${accent}22`
          : "none",
      }}
    >
      {filled ? (
        <>
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden"
            style={{ background: BSL.bgDeep, border: `1px solid ${accent}66` }}
          >
            {box!.logoUrl ? (
              <img
                src={box!.logoUrl}
                alt={box!.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Crown className="h-4 w-4" style={{ color: accent }} />
            )}
          </div>
          <div
            className="text-[11px] font-black truncate max-w-full px-1"
            style={{ color: BSL.text }}
          >
            {box!.name}
          </div>
          <div
            className="text-[8px] uppercase tracking-widest font-bold"
            style={{ color: accent }}
          >
            {locked ? "★ Locked" : label}
          </div>
        </>
      ) : (
        <>
          <motion.div
            animate={dragging ? { y: [0, -3, 0] } : { y: 0 }}
            transition={{ duration: 0.8, repeat: Infinity }}
          >
            <Crown
              className="h-5 w-5"
              style={{
                color: dragging ? BSL.cyan : BSL.faint,
                opacity: dragging ? 1 : 0.5,
              }}
            />
          </motion.div>
          <div
            className="text-[10px] font-bold uppercase tracking-widest"
            style={{ color: dragging ? BSL.cyan : BSL.faint }}
          >
            {dragging ? "Drop here" : label}
          </div>
        </>
      )}
    </motion.div>
  );
}

function ClubCard({
  club,
  expanded,
  onToggle,
  onChallenge,
  onDragStart,
  onDragEnd,
  canChallenge,
  isMine,
  isPlatformAdmin,
  isAdminBroker,
}: {
  club: ClubRow;
  expanded: boolean;
  onToggle: () => void;
  onChallenge: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  canChallenge: boolean;
  isMine: boolean;
  isPlatformAdmin?: boolean;
  isAdminBroker?: boolean;
}) {
  // Non-admin owners: their own club is auto-locked into the Battle Box's
  // home slot, so dragging it would only cause confusion. Only opponents
  // are draggable for them. Platform admins keep full broker freedom.
  const draggable = canChallenge || (isMine && !!isPlatformAdmin);
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileHover={{ y: -2 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: `linear-gradient(180deg, ${BSL.card} 0%, ${BSL.bgDeep} 100%)`,
        border: `1px solid ${isMine ? `${BSL.gold}66` : BSL.border}`,
        boxShadow: isMine
          ? `0 0 24px ${BSL.gold}33, 0 4px 30px ${BSL.bgDeep}aa`
          : `0 4px 30px ${BSL.bgDeep}aa`,
        cursor: draggable ? "grab" : "default",
      }}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        (e as any).dataTransfer.setData("text/club-id", String(club.id));
        (e as any).dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={() => onDragEnd?.()}
      data-testid={`card-club-${club.id}`}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden"
            style={{
              background: BSL.bgDeep,
              border: `1px solid ${BSL.border}`,
            }}
          >
            {club.logoUrl ? (
              <img
                src={club.logoUrl}
                alt={club.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <Crown className="h-6 w-6" style={{ color: BSL.gold }} />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3
                className="font-black text-base truncate"
                style={{ color: BSL.text }}
                data-testid={`text-club-name-${club.id}`}
              >
                {club.name}
              </h3>
              {isMine && (
                <span
                  className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase tracking-widest"
                  style={{ background: `${BSL.gold}22`, color: BSL.gold }}
                >
                  Yours
                </span>
              )}
            </div>
            <div className="text-xs mt-0.5" style={{ color: BSL.muted }}>
              {club.division}
            </div>
            {club.rank != null && (
              <div
                className="inline-flex items-center gap-1 text-xs mt-2 px-2 py-0.5 rounded-full font-bold"
                style={{
                  background: `${BSL.cyan}1a`,
                  color: BSL.cyan,
                  border: `1px solid ${BSL.cyan}44`,
                }}
              >
                <Trophy className="h-3 w-3" /> Rank #{club.rank}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-2 mt-4">
          <Stat label="Won" value={club.won} colour={BSL.success} />
          <Stat label="Lost" value={club.lost} colour={BSL.danger} />
          <Stat label="MP" value={club.played} colour={BSL.cyan} />
          <Stat label="Pts" value={club.points} colour={BSL.gold} />
        </div>

        <button
          onClick={onToggle}
          data-testid={`button-expand-${club.id}`}
          className="mt-4 w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition"
          style={{
            background: BSL.bgDeep,
            color: BSL.muted,
            border: `1px solid ${BSL.border}`,
          }}
        >
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {club.teams.length} teams
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 space-y-2">
                {club.teams.length === 0 ? (
                  <div
                    className="text-xs px-2 py-3 text-center"
                    style={{ color: BSL.muted }}
                  >
                    No teams registered yet.
                  </div>
                ) : (
                  club.teams.map((t) => (
                    <div
                      key={t.id}
                      className="rounded-lg p-2.5"
                      style={{
                        background: BSL.bgDeep,
                        border: `1px solid ${BSL.border}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          className="text-xs font-bold truncate"
                          style={{ color: BSL.text }}
                        >
                          {t.name}
                        </span>
                        {t.category && (
                          <span
                            className="text-[9px] px-1.5 py-0.5 rounded font-bold uppercase"
                            style={{
                              background: `${BSL.cyan}22`,
                              color: BSL.cyan,
                            }}
                          >
                            {t.category}
                          </span>
                        )}
                      </div>
                      {t.members.length === 0 ? (
                        <div
                          className="text-[10px]"
                          style={{ color: BSL.faint }}
                        >
                          No players assigned
                        </div>
                      ) : (
                        <div
                          className="text-[11px] leading-snug"
                          style={{ color: BSL.muted }}
                        >
                          {t.members.map((m) => m.name).join(" · ")}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {canChallenge ? (
          <ActionButton
            onClick={onChallenge}
            className="w-full mt-4"
            data-testid={`button-challenge-${club.id}`}
          >
            <Swords className="h-4 w-4" /> Challenge
          </ActionButton>
        ) : isMine ? (
          <div
            className="mt-4 text-center text-[10px] uppercase tracking-widest font-bold py-2 rounded-lg"
            style={{
              color: BSL.faint,
              background: BSL.bgDeep,
              border: `1px dashed ${BSL.border}`,
            }}
          >
            Your club
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

function Stat({
  label,
  value,
  colour,
}: {
  label: string;
  value: number;
  colour: string;
}) {
  return (
    <div
      className="text-center rounded-lg py-1.5"
      style={{ background: BSL.bgDeep, border: `1px solid ${BSL.border}` }}
    >
      <div
        className="text-base font-black tabular-nums"
        style={{ color: colour }}
      >
        {value}
      </div>
      <div
        className="text-[9px] uppercase tracking-widest"
        style={{ color: BSL.faint }}
      >
        {label}
      </div>
    </div>
  );
}

function ChallengeDialog({
  target,
  myClubs,
  matchDays,
  onClose,
  preselect,
}: {
  target: ClubRow;
  myClubs: ClubRow[];
  matchDays: MatchDay[];
  onClose: () => void;
  preselect?: { challengerId: number; leagueDayId: number } | null;
}) {
  const { toast } = useToast();
  const [challengerId, setChallengerId] = useState<number | null>(
    preselect?.challengerId ?? myClubs[0]?.id ?? null,
  );
  const [leagueDayId, setLeagueDayId] = useState<number | null>(
    preselect?.leagueDayId ?? null,
  );
  const [numMatches, setNumMatches] = useState(1);
  const [message, setMessage] = useState("");

  const usableDays = matchDays.filter(
    (d) => d.slotsRemaining == null || d.slotsRemaining > 0,
  );
  const selectedDay = matchDays.find((d) => d.id === leagueDayId) || null;
  const maxAllowed = selectedDay?.slotsRemaining ?? 20;
  const sendable =
    challengerId != null &&
    leagueDayId != null &&
    numMatches > 0 &&
    numMatches <= maxAllowed;

  const send = useMutation({
    mutationFn: async () =>
      apiRequest("POST", "/api/bsl/challenges", {
        challengerClubId: challengerId,
        opponentClubId: target.id,
        leagueDayId,
        numMatches,
        message: message.trim() || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bsl/challenges"] });
      queryClient.invalidateQueries({
        queryKey: ["/api/bsl/challenge-zone/match-days"],
      });
      toast({
        title: "Challenge sent!",
        description: `${target.name} will be notified.`,
      });
      onClose();
    },
    onError: (e: any) =>
      toast({
        title: "Could not send",
        description: e.message || "Try again",
        variant: "destructive",
      }),
  });

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: BSL.card,
          border: `1px solid ${BSL.border}`,
          boxShadow: `0 0 60px ${BSL.cyan}55`,
        }}
        data-testid="dialog-send-challenge"
      >
        <div className="p-5 border-b" style={{ borderColor: BSL.border }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className="text-xs uppercase tracking-widest font-bold"
                style={{ color: BSL.cyan }}
              >
                Send Challenge
              </div>
              <h2
                className="text-xl font-black mt-1"
                style={{ color: BSL.text }}
              >
                vs {target.name}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/5"
              data-testid="button-close-dialog"
            >
              <X className="h-5 w-5" style={{ color: BSL.muted }} />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Step 1: challenger */}
          <DialogField step="1" label="Your club">
            <select
              value={challengerId ?? ""}
              onChange={(e) => setChallengerId(Number(e.target.value))}
              data-testid="select-challenger-club"
              className="w-full px-3 py-2 rounded-lg text-sm font-semibold"
              style={{
                background: BSL.bgDeep,
                color: BSL.text,
                border: `1px solid ${BSL.border}`,
              }}
            >
              {myClubs.length === 0 && (
                <option value="">No clubs you can act for</option>
              )}
              {myClubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </DialogField>

          {/* Step 2: match day */}
          <DialogField
            step="2"
            label="Pick a Match Day"
            hint="Only official match days set by admin are available."
          >
            {usableDays.length === 0 ? (
              <div
                className="text-xs px-3 py-3 rounded-lg"
                style={{
                  color: BSL.faint,
                  background: BSL.bgDeep,
                  border: `1px dashed ${BSL.border}`,
                }}
              >
                No upcoming match days have free slots. Try again later.
              </div>
            ) : (
              <div className="space-y-2">
                {usableDays.map((d) => {
                  const active = leagueDayId === d.id;
                  const max = d.maxMatches;
                  const remaining = d.slotsRemaining;
                  return (
                    <button
                      key={d.id}
                      onClick={() => {
                        setLeagueDayId(d.id);
                        setNumMatches(Math.min(numMatches, remaining ?? 20));
                      }}
                      data-testid={`option-day-${d.id}`}
                      className="w-full text-left rounded-lg p-3 transition"
                      style={{
                        background: active ? `${BSL.cyan}1a` : BSL.bgDeep,
                        border: `1px solid ${active ? BSL.cyan : BSL.border}`,
                        boxShadow: active ? `0 0 20px ${BSL.cyan}55` : "none",
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div
                          className="inline-flex items-center gap-1.5 text-sm font-bold"
                          style={{ color: BSL.text }}
                        >
                          <Calendar
                            className="h-4 w-4"
                            style={{ color: BSL.cyan }}
                          />
                          {fmtDate(d.date)}
                        </div>
                        <span
                          className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                          style={{
                            background:
                              max == null
                                ? `${BSL.success}22`
                                : remaining! > 0
                                  ? `${BSL.gold}22`
                                  : `${BSL.danger}22`,
                            color:
                              max == null
                                ? BSL.success
                                : remaining! > 0
                                  ? BSL.gold
                                  : BSL.danger,
                          }}
                        >
                          {max == null
                            ? "Unlimited"
                            : `${remaining}/${max} slots`}
                        </span>
                      </div>
                      {d.venue && (
                        <div
                          className="text-xs mt-1 inline-flex items-center gap-1"
                          style={{ color: BSL.muted }}
                        >
                          <MapPin className="h-3 w-3" />
                          {d.venue}
                        </div>
                      )}
                      {max != null && (
                        <div
                          className="text-[11px] mt-1.5"
                          style={{ color: BSL.faint }}
                        >
                          {d.slotsUsed} match{d.slotsUsed === 1 ? "" : "es"}{" "}
                          already booked
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </DialogField>

          {/* Step 3: number of matches */}
          <DialogField
            step="3"
            label="How many matches?"
            hint="1 match = 1 team from your club vs 1 team from theirs. Each match uses one slot on the day."
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={Math.max(1, maxAllowed)}
                value={numMatches}
                onChange={(e) =>
                  setNumMatches(
                    Math.max(
                      1,
                      Math.min(
                        maxAllowed,
                        Math.round(Number(e.target.value) || 1),
                      ),
                    ),
                  )
                }
                data-testid="input-num-matches"
                className="w-24 px-3 py-2 rounded-lg text-sm font-bold tabular-nums text-center"
                style={{
                  background: BSL.bgDeep,
                  color: BSL.text,
                  border: `1px solid ${BSL.border}`,
                }}
              />
              <span className="text-xs" style={{ color: BSL.muted }}>
                of {selectedDay?.slotsRemaining ?? "unlimited"} slot
                {selectedDay?.slotsRemaining === 1 ? "" : "s"} left
              </span>
            </div>
          </DialogField>

          {/* Step 4: message */}
          <DialogField step="4" label="Message (optional)">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, 500))}
              rows={3}
              placeholder="Say something fun, suggest a format, set the trash talk…"
              data-testid="input-message"
              className="w-full px-3 py-2 rounded-lg text-sm resize-y"
              style={{
                background: BSL.bgDeep,
                color: BSL.text,
                border: `1px solid ${BSL.border}`,
              }}
            />
            <div
              className="text-[10px] mt-1 text-right"
              style={{ color: BSL.faint }}
            >
              {message.length}/500
            </div>
          </DialogField>
        </div>

        <div
          className="p-4 border-t flex gap-2"
          style={{ borderColor: BSL.border, background: BSL.bgDeep }}
        >
          <button
            onClick={onClose}
            data-testid="button-cancel-challenge"
            className="px-4 py-2 rounded-lg text-sm font-bold"
            style={{
              color: BSL.muted,
              background: BSL.card,
              border: `1px solid ${BSL.border}`,
            }}
          >
            Cancel
          </button>
          <ActionButton
            onClick={() => send.mutate()}
            disabled={!sendable || send.isPending}
            className="flex-1"
            data-testid="button-send-challenge"
          >
            <Send className="h-4 w-4" />{" "}
            {send.isPending ? "Sending…" : "Send Challenge"}
          </ActionButton>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DialogField({
  step,
  label,
  hint,
  children,
}: {
  step: string;
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-black"
          style={{ background: BSL.cyan, color: BSL.bgDeep }}
        >
          {step}
        </span>
        <label className="text-sm font-bold" style={{ color: BSL.text }}>
          {label}
        </label>
      </div>
      {children}
      {hint && (
        <div
          className="text-[10px] mt-1.5 leading-snug"
          style={{ color: BSL.faint }}
        >
          {hint}
        </div>
      )}
    </div>
  );
}

function ChallengeList({
  title,
  tone,
  rows,
  canRespond,
  onAction,
  myClubIds,
  user,
  matchDays,
}: {
  title: string;
  tone: "cyan" | "gold" | "muted";
  rows: Challenge[];
  canRespond: boolean;
  onAction: (id: number, action: string) => void;
  myClubIds: Set<number>;
  user: { id: number; role: string };
  matchDays: MatchDay[];
}) {
  const accent =
    tone === "cyan" ? BSL.cyan : tone === "gold" ? BSL.gold : BSL.muted;
  return (
    <GlowPanel className="p-4">
      <h2
        className="text-xs uppercase tracking-widest font-black mb-3"
        style={{ color: accent }}
      >
        {title}
      </h2>
      <div className="space-y-2">
        {rows.map((c) => {
          const isChallenger = myClubIds.has(c.challengerClubId);
          const isOpponent = myClubIds.has(c.opponentClubId);
          const isPlatformAdmin =
            user.role === "OWNER" || user.role === "ADMIN";
          return (
            <div
              key={c.id}
              className="rounded-xl p-3"
              style={{
                background: BSL.bgDeep,
                border: `1px solid ${BSL.border}`,
              }}
              data-testid={`row-challenge-${c.id}`}
            >
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div
                  className="text-sm font-bold inline-flex items-center gap-2"
                  style={{ color: BSL.text }}
                >
                  <span>{c.challengerClub?.name || "?"}</span>
                  <Swords className="h-3.5 w-3.5" style={{ color: BSL.cyan }} />
                  <span>{c.opponentClub?.name || "?"}</span>
                </div>
                <StatusPill status={c.status} />
              </div>
              <div
                className="text-xs mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1"
                style={{ color: BSL.muted }}
              >
                {c.leagueDay && (
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {fmtDate(c.leagueDay.date)}
                  </span>
                )}
                {c.leagueDay?.venue && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {c.leagueDay.venue}
                  </span>
                )}
                <span>
                  · {c.numMatches} match{c.numMatches === 1 ? "" : "es"}
                </span>
              </div>
              {c.message && (
                <div
                  className="text-xs mt-2 italic px-2 py-1.5 rounded"
                  style={{
                    color: BSL.muted,
                    background: `${BSL.card}80`,
                    border: `1px solid ${BSL.border}`,
                  }}
                >
                  "{c.message}"
                </div>
              )}
              {canRespond && c.status === "PENDING" && (
                <div className="flex gap-2 mt-3">
                  {isOpponent || isPlatformAdmin ? (
                    <>
                      <button
                        onClick={() => onAction(c.id, "accept")}
                        data-testid={`button-accept-${c.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest"
                        style={{
                          background: `${BSL.success}22`,
                          color: BSL.success,
                          border: `1px solid ${BSL.success}55`,
                        }}
                      >
                        <Check className="h-3.5 w-3.5" /> Accept
                      </button>
                      <button
                        onClick={() => onAction(c.id, "decline")}
                        data-testid={`button-decline-${c.id}`}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest"
                        style={{
                          background: `${BSL.danger}22`,
                          color: BSL.danger,
                          border: `1px solid ${BSL.danger}55`,
                        }}
                      >
                        <X className="h-3.5 w-3.5" /> Decline
                      </button>
                    </>
                  ) : isChallenger ? (
                    <button
                      onClick={() => onAction(c.id, "cancel")}
                      data-testid={`button-cancel-${c.id}`}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest"
                      style={{
                        background: `${BSL.muted}22`,
                        color: BSL.text,
                        border: `1px solid ${BSL.border}`,
                      }}
                    >
                      Cancel challenge
                    </button>
                  ) : null}
                </div>
              )}
              {canRespond &&
                c.status === "ACCEPTED" &&
                (isChallenger || isOpponent || isPlatformAdmin) && (
                  <button
                    onClick={() => onAction(c.id, "complete")}
                    data-testid={`button-complete-${c.id}`}
                    className="mt-3 w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-widest"
                    style={{
                      background: `${BSL.gold}22`,
                      color: BSL.gold,
                      border: `1px solid ${BSL.gold}55`,
                    }}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> Mark completed
                  </button>
                )}
            </div>
          );
        })}
      </div>
    </GlowPanel>
  );
}

function StatusPill({ status }: { status: Challenge["status"] }) {
  const map: Record<
    Challenge["status"],
    { bg: string; fg: string; icon: any; label: string }
  > = {
    PENDING: {
      bg: `${BSL.cyan}22`,
      fg: BSL.cyan,
      icon: Hourglass,
      label: "Pending",
    },
    ACCEPTED: {
      bg: `${BSL.success}22`,
      fg: BSL.success,
      icon: Check,
      label: "Accepted",
    },
    DECLINED: {
      bg: `${BSL.danger}22`,
      fg: BSL.danger,
      icon: X,
      label: "Declined",
    },
    CANCELLED: {
      bg: `${BSL.muted}22`,
      fg: BSL.muted,
      icon: X,
      label: "Cancelled",
    },
    COMPLETED: {
      bg: `${BSL.gold}22`,
      fg: BSL.gold,
      icon: CheckCircle2,
      label: "Completed",
    },
  };
  const m = map[status];
  const Icon = m.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full"
      style={{ background: m.bg, color: m.fg }}
    >
      <Icon className="h-3 w-3" /> {m.label}
    </span>
  );
}
