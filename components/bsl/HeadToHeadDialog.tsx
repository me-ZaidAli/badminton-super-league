import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Loader2, Swords } from "lucide-react";
import { BSL } from "./BSLPalette";

type RubberOut = {
  type: string;
  aPlayers: string[];
  bPlayers: string[];
  aPoints: number;
  bPoints: number;
  aSets: number;
  bSets: number;
  sets: Array<{ a: number; b: number }>;
};
type FixtureOut = {
  fixtureId: number;
  date: string | null;
  aPoints: number;
  bPoints: number;
  aSets: number;
  bSets: number;
  result: "A" | "B" | "DRAW";
  rubbers: RubberOut[];
};
type H2H = {
  clubA: { id: number; name: string; logo: string | null };
  clubB: { id: number; name: string; logo: string | null };
  summary: {
    fixtures: number;
    aWins: number;
    bWins: number;
    draws: number;
    aSets: number;
    bSets: number;
    aPoints: number;
    bPoints: number;
  };
  fixtures: FixtureOut[];
};

function ClubCrest({
  name,
  logo,
  side,
}: {
  name: string;
  logo: string | null;
  side: "a" | "b";
}) {
  const accent = side === "a" ? BSL.gold : BSL.cyan;
  return (
    <div className="flex flex-col items-center gap-1.5 min-w-0">
      <div
        className="h-12 w-12 rounded-xl overflow-hidden flex items-center justify-center text-sm font-black shrink-0"
        style={{
          background: `${accent}22`,
          color: accent,
          border: `1px solid ${accent}55`,
        }}
      >
        {logo ? (
          <img src={logo} alt={name} className="h-full w-full object-cover" />
        ) : (
          name.slice(0, 2).toUpperCase()
        )}
      </div>
      <div
        className="text-xs font-semibold text-center truncate max-w-[110px]"
        style={{ color: BSL.text }}
      >
        {name}
      </div>
    </div>
  );
}

export function HeadToHeadDialog({
  open,
  onOpenChange,
  clubA,
  clubB,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clubA: number | null;
  clubB: number | null;
}) {
  const enabled = open && clubA != null && clubB != null && clubA !== clubB;
  const { data, isLoading, isError } = useQuery<H2H>({
    queryKey: ["/api/bsl/head-to-head", clubA, clubB],
    enabled,
    queryFn: async () => {
      const r = await fetch(
        `/api/bsl/head-to-head?clubA=${clubA}&clubB=${clubB}`,
        { credentials: "include" },
      );
      if (!r.ok) throw new Error(await r.text());
      return r.json();
    },
  });

  const s = data?.summary;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-2xl p-0 overflow-hidden border-0 gap-0 max-h-[90vh] overflow-y-auto text-white"
        style={{
          background: BSL.bg,
          border: `1px solid ${BSL.border}`,
          boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
        }}
        data-testid="dialog-head-to-head"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Head to Head</DialogTitle>
          <DialogDescription>Club versus club match history</DialogDescription>
        </DialogHeader>

        {/* HEADER */}
        <div
          className="px-5 pt-5 pb-4"
          style={{
            background: `linear-gradient(135deg, ${BSL.cardSoft}, ${BSL.bg})`,
            borderBottom: `1px solid ${BSL.border}`,
          }}
        >
          <div className="flex items-center justify-center gap-2 mb-4">
            <Swords className="h-4 w-4" style={{ color: BSL.gold }} />
            <span
              className="text-[10px] uppercase tracking-[0.3em] font-black"
              style={{ color: BSL.gold }}
            >
              Head to Head
            </span>
          </div>
          {data ? (
            <div className="flex items-center justify-between gap-3">
              <ClubCrest
                name={data.clubA.name}
                logo={data.clubA.logo}
                side="a"
              />
              <div className="flex flex-col items-center">
                {s && s.fixtures > 0 ? (
                  <div className="flex items-center gap-2 tabular-nums">
                    <span
                      className="text-3xl font-black"
                      style={{ color: BSL.gold }}
                      data-testid="h2h-wins-a"
                    >
                      {s.aWins}
                    </span>
                    <span
                      className="text-lg font-bold"
                      style={{ color: BSL.muted }}
                    >
                      –
                    </span>
                    <span
                      className="text-3xl font-black"
                      style={{ color: BSL.cyan }}
                      data-testid="h2h-wins-b"
                    >
                      {s.bWins}
                    </span>
                  </div>
                ) : (
                  <span
                    className="text-sm font-bold"
                    style={{ color: BSL.muted }}
                  >
                    VS
                  </span>
                )}
                <span
                  className="text-[9px] uppercase tracking-widest mt-1"
                  style={{ color: BSL.faint }}
                >
                  {s && s.fixtures > 0
                    ? `${s.fixtures} meeting${s.fixtures === 1 ? "" : "s"}${s.draws ? ` · ${s.draws} drawn` : ""}`
                    : "no meetings yet"}
                </span>
              </div>
              <ClubCrest
                name={data.clubB.name}
                logo={data.clubB.logo}
                side="b"
              />
            </div>
          ) : (
            <div
              className="h-16 flex items-center justify-center text-sm"
              style={{ color: BSL.muted }}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Loading…"
              )}
            </div>
          )}
          {s && s.fixtures > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 text-center">
              <div
                className="rounded-xl py-2"
                style={{
                  background: "hsla(0,0%,100%,0.04)",
                  border: `1px solid ${BSL.border}`,
                }}
              >
                <div
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: BSL.faint }}
                >
                  Total Points
                </div>
                <div className="tabular-nums font-bold mt-0.5">
                  <span style={{ color: BSL.gold }}>{s.aPoints}</span>
                  <span style={{ color: BSL.muted }} className="mx-1.5">
                    –
                  </span>
                  <span style={{ color: BSL.cyan }}>{s.bPoints}</span>
                </div>
              </div>
              <div
                className="rounded-xl py-2"
                style={{
                  background: "hsla(0,0%,100%,0.04)",
                  border: `1px solid ${BSL.border}`,
                }}
              >
                <div
                  className="text-[9px] uppercase tracking-widest"
                  style={{ color: BSL.faint }}
                >
                  Avg Points / Meeting
                </div>
                <div className="tabular-nums font-bold mt-0.5">
                  <span style={{ color: BSL.gold }}>
                    {s.fixtures > 0 ? Math.round(s.aPoints / s.fixtures) : 0}
                  </span>
                  <span style={{ color: BSL.muted }} className="mx-1.5">
                    –
                  </span>
                  <span style={{ color: BSL.cyan }}>
                    {s.fixtures > 0 ? Math.round(s.bPoints / s.fixtures) : 0}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* BODY */}
        {isLoading ? (
          <div
            className="px-5 py-10 text-center text-sm flex items-center justify-center gap-2"
            style={{ color: BSL.muted }}
          >
            <Loader2 className="h-4 w-4 animate-spin" /> Loading head-to-head…
          </div>
        ) : isError ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: BSL.danger }}
          >
            Couldn't load this matchup — try again.
          </div>
        ) : !data || data.fixtures.length === 0 ? (
          <div
            className="px-5 py-10 text-center text-sm"
            style={{ color: BSL.muted }}
            data-testid="h2h-empty"
          >
            These two clubs haven't met in a finished match yet.
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <div
              className="text-[10px] uppercase tracking-[0.2em] font-semibold"
              style={{ color: BSL.muted }}
            >
              All Meetings
            </div>
            {data.fixtures.map((f) => {
              const aWon = f.result === "A";
              const bWon = f.result === "B";
              return (
                <motion.div
                  key={f.fixtureId}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl overflow-hidden"
                  style={{
                    background: BSL.card,
                    border: `1px solid ${BSL.border}`,
                  }}
                  data-testid={`h2h-fixture-${f.fixtureId}`}
                >
                  {/* Fixture header */}
                  <div
                    className="flex items-center justify-between gap-3 px-4 py-2.5"
                    style={{ borderBottom: `1px solid ${BSL.border}` }}
                  >
                    <span
                      className="text-[10px] uppercase tracking-widest"
                      style={{ color: BSL.faint }}
                    >
                      {f.date
                        ? new Date(f.date).toLocaleDateString("en-GB", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date TBC"}
                    </span>
                    <div className="flex items-center gap-2 tabular-nums">
                      <span
                        className="text-lg font-black"
                        style={{
                          color: aWon ? BSL.gold : BSL.text,
                          opacity: aWon ? 1 : 0.7,
                        }}
                      >
                        {f.aPoints}
                      </span>
                      <span className="text-xs" style={{ color: BSL.muted }}>
                        –
                      </span>
                      <span
                        className="text-lg font-black"
                        style={{
                          color: bWon ? BSL.cyan : BSL.text,
                          opacity: bWon ? 1 : 0.7,
                        }}
                      >
                        {f.bPoints}
                      </span>
                      <span
                        className="text-[9px] uppercase tracking-widest ml-1"
                        style={{ color: BSL.faint }}
                      >
                        pts
                      </span>
                    </div>
                  </div>
                  {/* Rubbers */}
                  <div className="px-4 py-2 space-y-1.5">
                    {f.rubbers.length === 0 ? (
                      <div
                        className="text-[11px] py-1"
                        style={{ color: BSL.muted }}
                      >
                        No game detail recorded.
                      </div>
                    ) : (
                      f.rubbers.map((rb, i) => {
                        const rbAWon = rb.aPoints > rb.bPoints;
                        const rbBWon = rb.bPoints > rb.aPoints;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2 text-[11px]"
                            data-testid={`h2h-rubber-${f.fixtureId}-${i}`}
                          >
                            <span
                              className="font-semibold w-12 shrink-0 uppercase"
                              style={{ color: BSL.faint }}
                            >
                              {rb.type}
                            </span>
                            <span
                              className="flex-1 min-w-0 truncate"
                              style={{ color: rbAWon ? BSL.gold : BSL.muted }}
                            >
                              {rb.aPlayers.join(" / ") || "—"}
                            </span>
                            <div className="flex items-center gap-1 shrink-0 tabular-nums font-bold">
                              <span
                                style={{ color: rbAWon ? BSL.gold : BSL.muted }}
                              >
                                {rb.aPoints}
                              </span>
                              <span style={{ color: BSL.muted }}>–</span>
                              <span
                                style={{ color: rbBWon ? BSL.cyan : BSL.muted }}
                              >
                                {rb.bPoints}
                              </span>
                            </div>
                            <span
                              className="flex-1 min-w-0 truncate text-right"
                              style={{ color: rbBWon ? BSL.cyan : BSL.muted }}
                            >
                              {rb.bPlayers.join(" / ") || "—"}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
