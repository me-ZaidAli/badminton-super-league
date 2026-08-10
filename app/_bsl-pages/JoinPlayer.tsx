import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation, useSearch } from "@/lib/routing";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Check, Hash, Users } from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { BslClub, BslPlayer, BslTeam } from "@/lib/types";

const STEPS = ["code", "team"] as const;

export default function JoinPlayer() {
  const [, setLoc] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  const search = useSearch();
  const initialCode = (
    new URLSearchParams(search).get("code") || ""
  ).toUpperCase();
  const [step, setStep] = useState<(typeof STEPS)[number]>("code");
  const [code, setCode] = useState(initialCode);
  const [autoValidated, setAutoValidated] = useState(false);
  const [validatedClub, setValidatedClub] = useState<BslClub | null>(null);
  const [teamId, setTeamId] = useState<number | null>(null);

  // If the user is already a BSL player, don't keep them stuck in the join wizard —
  // bounce them to the right place based on their current status.
  const { data: existingPlayer } = useQuery<BslPlayer | null>({
    queryKey: ["/api/bsl/players/me"],
  });
  useEffect(() => {
    if (!existingPlayer) return;
    if (existingPlayer.status === "ACTIVE") {
      toast({
        title: "You're already a BSL player",
        description: "Taking you to your profile…",
      });
      setLoc("/profile");
    } else if (existingPlayer.status === "PENDING_VERIFICATION") {
      toast({
        title: "Already submitted",
        description: "Your payment is awaiting admin verification.",
      });
      setLoc("/profile");
    } else if (existingPlayer.status === "PENDING_PAYMENT") {
      // They've already joined the club — send them to the profile where they can
      // pay the league fee from wallet (if topped up) or be guided to top up.
      toast({
        title: "Finish activating",
        description:
          "You've joined — now pay the league fee to unlock the league.",
      });
      setLoc("/profile");
    }
  }, [existingPlayer?.id, existingPlayer?.status]);

  const { data: clubTeams = [] } = useQuery<BslTeam[]>({
    queryKey: ["/api/bsl/clubs", validatedClub?.id, "teams"],
    enabled: !!validatedClub?.id,
    queryFn: async () => {
      const r = await fetch(`/api/bsl/clubs/${validatedClub!.id}/teams`, {
        credentials: "include",
      });
      return r.json();
    },
  });

  const validateMutation = useMutation({
    mutationFn: async (): Promise<BslClub> => {
      const r = await fetch(
        `/api/bsl/clubs/validate-invite?code=${encodeURIComponent(code.toUpperCase())}`,
        { credentials: "include" },
      );
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || "Invalid invite code");
      return data;
    },
    onSuccess: (club) => {
      setValidatedClub(club);
      setStep("team");
    },
    onError: (e: Error) =>
      toast({
        title: "Invalid code",
        description: e.message,
        variant: "destructive",
      }),
  });

  // Auto-validate when arriving with ?code=… in the URL (QR / shared link)
  useEffect(() => {
    if (
      initialCode &&
      initialCode.length >= 6 &&
      !autoValidated &&
      step === "code"
    ) {
      setAutoValidated(true);
      validateMutation.mutate();
    }
  }, [initialCode, autoValidated, step]);

  const joinMutation = useMutation({
    mutationFn: async (): Promise<BslPlayer> => {
      const r = await apiRequest("POST", "/api/bsl/players/join", {
        inviteCode: code.toUpperCase(),
        teamId,
      });
      return r.json();
    },
    onSuccess: async () => {
      toast({
        title: "You're in!",
        description: "Welcome to the club — check out your profile.",
      });
      // Profile page reads the dashboard query, not this one — invalidate both
      // and wait for the refetch so it doesn't render stale "not joined" data.
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["/api/bsl/players/me"] }),
        qc.invalidateQueries({ queryKey: ["/api/bsl/players/me/dashboard"] }),
      ]);
      setLoc("/profile");
    },
    onError: (e: Error) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  // Auto-select if there's only one team — saves the user a guess-and-tap.
  // Adjusted during render (not an effect) per https://react.dev/learn/you-might-not-need-an-effect
  if (clubTeams.length === 1 && teamId == null) {
    setTeamId(clubTeams[0].id);
  }

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <div className="max-w-2xl mx-auto px-4 md:px-8 pt-8">
        <Link href="/">
          <a
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
            style={{ color: BSL.muted }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to BSL
          </a>
        </Link>
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-2">
          Join as <span style={{ color: BSL.cyan }}>Player</span>
        </h1>
        <p className="text-sm mb-8" style={{ color: BSL.muted }}>
          Enter your club's invite code and pick your team to join.
        </p>

        <GlowPanel
          title={step === "code" ? "Invite Code" : "Pick Your Team"}
          tone="cyan"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              {step === "code" && (
                <div className="space-y-4">
                  <p className="text-sm" style={{ color: BSL.muted }}>
                    Get this 10-character code from your club captain.
                  </p>
                  <div className="relative">
                    <Hash
                      className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5"
                      style={{ color: BSL.cyan }}
                    />
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="XXXXXXYYYY"
                      className="w-full pl-12 pr-4 py-4 rounded-lg font-mono text-lg tracking-[0.4em] text-white placeholder-white/20 outline-none uppercase"
                      style={{
                        background: "hsla(0,0%,100%,0.05)",
                        border: `1px solid ${BSL.cyan}55`,
                      }}
                      maxLength={12}
                      data-testid="input-invite-code"
                    />
                  </div>
                  <ActionButton
                    variant="cyan"
                    fullWidth
                    onClick={() => validateMutation.mutate()}
                    loading={validateMutation.isPending}
                    disabled={code.length < 6}
                  >
                    Validate Code
                  </ActionButton>
                </div>
              )}
              {step === "team" && validatedClub && (
                <div className="space-y-4">
                  <div
                    className="rounded-xl p-3 flex items-center gap-3"
                    style={{
                      background: `${BSL.cyan}10`,
                      border: `1px solid ${BSL.cyan}33`,
                    }}
                  >
                    <div
                      className="h-10 w-10 rounded-lg overflow-hidden flex items-center justify-center text-xs font-black"
                      style={{ background: `${BSL.cyan}22`, color: BSL.cyan }}
                    >
                      {validatedClub.logoUrl ? (
                        <img
                          src={validatedClub.logoUrl}
                          className="h-full w-full object-cover"
                          alt={validatedClub.name}
                        />
                      ) : (
                        validatedClub.name.slice(0, 2)
                      )}
                    </div>
                    <div>
                      <div className="font-bold">{validatedClub.name}</div>
                      <div
                        className="text-[10px] uppercase tracking-widest"
                        style={{ color: BSL.muted }}
                      >
                        {validatedClub.division}
                      </div>
                    </div>
                  </div>
                  {clubTeams.length === 0 ? (
                    <div
                      className="rounded-xl px-4 py-6 text-center text-sm"
                      style={{
                        background: "hsla(0,0%,100%,0.04)",
                        color: BSL.muted,
                        border: `1px dashed ${BSL.cyan}55`,
                      }}
                    >
                      Your club hasn't set up any teams yet — that's fine. You
                      can still join and your club captain will assign you to a
                      pair later.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {clubTeams.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setTeamId(t.id)}
                          className="rounded-xl px-4 py-4 text-left transition-all"
                          style={{
                            background:
                              teamId === t.id
                                ? `${BSL.cyan}22`
                                : "hsla(0,0%,100%,0.04)",
                            border: `2px solid ${teamId === t.id ? BSL.cyan : "hsla(0,0%,100%,0.1)"}`,
                            boxShadow:
                              teamId === t.id
                                ? `0 0 24px ${BSL.cyan}55`
                                : "none",
                          }}
                          data-testid={`team-${t.id}`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <Users
                              className="h-4 w-4"
                              style={{
                                color: teamId === t.id ? BSL.cyan : BSL.muted,
                              }}
                            />
                            {teamId === t.id && (
                              <span
                                className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full"
                                style={{
                                  background: BSL.cyan,
                                  color: BSL.bgDeep,
                                }}
                              >
                                <Check className="h-2.5 w-2.5" /> Selected
                              </span>
                            )}
                          </div>
                          <div className="font-bold">{t.name}</div>
                          <div
                            className="text-[10px] uppercase tracking-widest"
                            style={{ color: BSL.muted }}
                          >
                            {t.division}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <ActionButton
                    variant="cyan"
                    fullWidth
                    onClick={() => joinMutation.mutate()}
                    loading={joinMutation.isPending}
                    disabled={clubTeams.length > 0 && !teamId}
                    icon={<ArrowRight className="h-4 w-4" />}
                  >
                    {clubTeams.length === 0
                      ? "Continue"
                      : teamId
                        ? "Confirm Team"
                        : "Pick a team above"}
                  </ActionButton>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </GlowPanel>
      </div>
    </div>
  );
}
