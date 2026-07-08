import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRoute } from "@/lib/routing";
import { motion } from "framer-motion";
import { ArrowLeft, Activity, Edit3, Save, Play, Square } from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useUser } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const RUBBER_LABELS: Record<string, string> = {
  MS1: "Men's Singles 1",
  MS2: "Men's Singles 2",
  WS: "Women's Singles",
  MD: "Men's Doubles",
  WD: "Women's Doubles",
  XD: "Mixed Doubles",
};

function RubberRow({
  rubber,
  isAdmin,
  onSave,
}: {
  rubber: any;
  isAdmin: boolean;
  onSave: (id: number, hs: number, as_: number, status: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [hs, setHs] = useState(rubber.homeScore);
  const [as_, setAs] = useState(rubber.awayScore);
  useEffect(() => {
    setHs(rubber.homeScore);
    setAs(rubber.awayScore);
  }, [rubber.id, rubber.homeScore, rubber.awayScore]);
  const tone =
    rubber.status === "LIVE"
      ? BSL.danger
      : rubber.status === "FINISHED"
        ? BSL.success
        : BSL.cyan;
  const winner =
    rubber.homeScore > rubber.awayScore
      ? "home"
      : rubber.awayScore > rubber.homeScore
        ? "away"
        : null;
  return (
    <motion.div
      whileHover={{ scale: 1.005 }}
      className="rounded-xl p-4"
      style={{
        background: "hsla(0,0%,100%,0.03)",
        border: `1px solid ${tone}33`,
      }}
      data-testid={`rubber-${rubber.id}`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="h-7 w-7 rounded-lg flex items-center justify-center text-[10px] font-black"
            style={{ background: `${BSL.gold}22`, color: BSL.gold }}
          >
            {rubber.rubberNumber}
          </div>
          <div>
            <div className="text-sm font-bold">
              {RUBBER_LABELS[rubber.rubberType] || rubber.rubberType}
            </div>
            <div
              className="text-[10px] uppercase tracking-widest"
              style={{ color: tone }}
            >
              {rubber.status}
            </div>
          </div>
        </div>
        {isAdmin && !editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs uppercase tracking-widest font-bold inline-flex items-center gap-1"
            style={{ color: BSL.cyan }}
            data-testid={`button-edit-${rubber.id}`}
          >
            <Edit3 className="h-3 w-3" /> Edit
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3 items-center">
        <div className="flex items-center justify-between">
          <span
            className="text-sm"
            style={{ color: winner === "home" ? BSL.gold : BSL.muted }}
          >
            Home
          </span>
          {editing ? (
            <input
              type="number"
              min={0}
              value={hs}
              onChange={(e) => setHs(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded text-center text-2xl font-black tabular-nums text-white"
              style={{
                background: "hsla(0,0%,100%,0.05)",
                border: `1px solid ${BSL.cyan}55`,
              }}
              data-testid={`input-home-${rubber.id}`}
            />
          ) : (
            <span
              className="text-2xl font-black tabular-nums"
              style={{ color: winner === "home" ? BSL.gold : BSL.text }}
            >
              {rubber.homeScore}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <span
            className="text-sm"
            style={{ color: winner === "away" ? BSL.gold : BSL.muted }}
          >
            Away
          </span>
          {editing ? (
            <input
              type="number"
              min={0}
              value={as_}
              onChange={(e) => setAs(Number(e.target.value))}
              className="w-16 px-2 py-1 rounded text-center text-2xl font-black tabular-nums text-white"
              style={{
                background: "hsla(0,0%,100%,0.05)",
                border: `1px solid ${BSL.cyan}55`,
              }}
              data-testid={`input-away-${rubber.id}`}
            />
          ) : (
            <span
              className="text-2xl font-black tabular-nums"
              style={{ color: winner === "away" ? BSL.gold : BSL.text }}
            >
              {rubber.awayScore}
            </span>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-3 flex flex-wrap gap-2 justify-end">
          <ActionButton
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setHs(rubber.homeScore);
              setAs(rubber.awayScore);
            }}
          >
            Cancel
          </ActionButton>
          <ActionButton
            variant="cyan"
            icon={<Play className="h-3 w-3" />}
            onClick={() => onSave(rubber.id, hs, as_, "LIVE")}
          >
            Live
          </ActionButton>
          <ActionButton
            variant="gold"
            icon={<Save className="h-3 w-3" />}
            onClick={() => {
              onSave(rubber.id, hs, as_, "FINISHED");
              setEditing(false);
            }}
          >
            Finish
          </ActionButton>
        </div>
      )}
    </motion.div>
  );
}

export default function MatchDetail() {
  const [, params] = useRoute<{ id: string }>("/bsl/match/:id");
  const id = Number(params?.id);
  const { data: user } = useUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const isAdmin =
    (user as any)?.role === "OWNER" || (user as any)?.role === "ADMIN";

  const { data: match } = useQuery<any>({
    queryKey: ["/api/bsl/fixtures", id],
    enabled: !!id,
    // Poll every 10s so everyone watching sees scores update live as the admin
    // types them into Quick Results — no manual refresh needed.
    refetchInterval: 10000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const r = await fetch(`/api/bsl/fixtures/${id}`, {
        credentials: "include",
      });
      return r.json();
    },
  });

  const updateRubber = useMutation({
    mutationFn: async ({
      rid,
      homeScore,
      awayScore,
      status,
    }: {
      rid: number;
      homeScore: number;
      awayScore: number;
      status: string;
    }) =>
      (
        await apiRequest("PATCH", `/api/bsl/rubbers/${rid}`, {
          homeScore,
          awayScore,
          status,
        })
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures", id] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/standings"] });
      toast({ title: "Score updated" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const fixtureStatus = useMutation({
    mutationFn: async (status: string) =>
      (await apiRequest("PATCH", `/api/bsl/fixtures/${id}`, { status })).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures", id] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/standings"] });
    },
  });

  if (!match) {
    return (
      <div
        className="min-h-screen text-white flex items-center justify-center"
        style={{ background: BSL.bgDeep }}
      >
        <BSLBackground />
        <div className="text-sm" style={{ color: BSL.muted }}>
          Loading match...
        </div>
      </div>
    );
  }
  // Pair-vs-pair fixtures put the name on the team row; club-vs-club fixtures
  // put it on the hydrated homeClub/awayClub the API now returns.
  const homeTeam = match.teams?.find((t: any) => t.id === match.homeTeamId);
  const awayTeam = match.teams?.find((t: any) => t.id === match.awayTeamId);
  const home = { name: homeTeam?.name || match.homeClub?.name };
  const away = { name: awayTeam?.name || match.awayClub?.name };

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <div className="max-w-4xl mx-auto px-4 md:px-8 pt-8">
        <Link href="/">
          <a
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
            style={{ color: BSL.muted }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to BSL
          </a>
        </Link>

        {/* Big scoreboard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl overflow-hidden mb-6"
          style={{
            background: `linear-gradient(135deg, hsla(222,40%,18%,0.85), hsla(222,45%,8%,0.95))`,
            border: `1px solid ${BSL.gold}55`,
            boxShadow: `0 24px 60px -20px ${BSL.gold}44`,
          }}
        >
          <div
            className="flex items-center justify-between px-5 pt-4 text-[10px] uppercase tracking-[0.3em]"
            style={{ color: BSL.muted }}
          >
            <span className="inline-flex items-center gap-1.5">
              <Activity className="h-3 w-3" style={{ color: BSL.cyan }} /> Match
              #{match.id}
            </span>
            <span
              style={{ color: match.status === "LIVE" ? BSL.danger : BSL.gold }}
            >
              {match.status}
            </span>
          </div>
          <div className="grid grid-cols-3 items-center px-6 py-8 gap-4">
            <div className="text-center">
              <div
                className="text-xs uppercase tracking-widest mb-2"
                style={{ color: BSL.muted }}
              >
                Home
              </div>
              <div className="text-lg md:text-xl font-bold mb-2">
                {home?.name || "TBD"}
              </div>
              <div
                className="text-6xl md:text-7xl font-black tabular-nums"
                style={{
                  color: BSL.gold,
                  textShadow: `0 0 32px ${BSL.gold}66`,
                }}
                data-testid="home-points"
              >
                {match.homePoints ?? 0}
              </div>
              <div
                className="text-[10px] uppercase tracking-widest mt-2"
                style={{ color: BSL.muted }}
                data-testid="home-rubbers-sets"
              >
                {match.homeRubbers} rubbers
              </div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-thin" style={{ color: BSL.faint }}>
                VS
              </div>
              <div
                className="text-[10px] uppercase tracking-widest mt-1"
                style={{ color: BSL.muted }}
              >
                Points
              </div>
            </div>
            <div className="text-center">
              <div
                className="text-xs uppercase tracking-widest mb-2"
                style={{ color: BSL.muted }}
              >
                Away
              </div>
              <div className="text-lg md:text-xl font-bold mb-2">
                {away?.name || "TBD"}
              </div>
              <div
                className="text-6xl md:text-7xl font-black tabular-nums"
                style={{
                  color: BSL.cyan,
                  textShadow: `0 0 32px ${BSL.cyan}66`,
                }}
                data-testid="away-points"
              >
                {match.awayPoints ?? 0}
              </div>
              <div
                className="text-[10px] uppercase tracking-widest mt-2"
                style={{ color: BSL.muted }}
                data-testid="away-rubbers-sets"
              >
                {match.awayRubbers} rubbers
              </div>
            </div>
          </div>
          {isAdmin && (
            <div
              className="flex flex-wrap gap-2 justify-center pb-5 border-t pt-4"
              style={{ borderColor: "hsla(0,0%,100%,0.06)" }}
            >
              <ActionButton
                variant="cyan"
                onClick={() => fixtureStatus.mutate("WARMUP")}
                icon={<Activity className="h-3 w-3" />}
              >
                Warmup
              </ActionButton>
              <ActionButton
                variant="gold"
                onClick={() => fixtureStatus.mutate("LIVE")}
                icon={<Play className="h-3 w-3" />}
              >
                Start Live
              </ActionButton>
              <ActionButton
                variant="ghost"
                onClick={() => fixtureStatus.mutate("FINISHED")}
                icon={<Square className="h-3 w-3" />}
              >
                Finish
              </ActionButton>
            </div>
          )}
        </motion.div>

        <GlowPanel
          title="6 Rubbers"
          subtitle="Click edit to score (admin only)"
          tone="cyan"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(match.rubbers || []).map((r: any) => (
              <RubberRow
                key={r.id}
                rubber={r}
                isAdmin={isAdmin}
                onSave={(rid, hs, as_, status) =>
                  updateRubber.mutate({
                    rid,
                    homeScore: hs,
                    awayScore: as_,
                    status,
                  })
                }
              />
            ))}
          </div>
        </GlowPanel>
      </div>
    </div>
  );
}
