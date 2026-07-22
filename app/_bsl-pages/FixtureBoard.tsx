import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@/lib/routing";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, Plus, Activity } from "lucide-react";
import { BSLBackground } from "@/components/bsl/BSLBackground";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const COURTS = [1, 2, 3, 4, 5, 6];

export default function FixtureBoard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [draggedId, setDraggedId] = useState<number | null>(null);
  const [creatingHome, setCreatingHome] = useState<number | null>(null);
  const [creatingAway, setCreatingAway] = useState<number | null>(null);

  const { data: fixtures = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/fixtures"],
  });
  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["/api/bsl/standings"],
    queryFn: async () =>
      (await fetch("/api/bsl/standings", { credentials: "include" })).json(),
  });

  const setCourt = useMutation({
    mutationFn: async ({ id, court }: { id: number; court: number | null }) =>
      (await apiRequest("PATCH", `/api/bsl/fixtures/${id}`, { court })).json(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] }),
  });

  const create = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/bsl/fixtures", {
          homeTeamId: creatingHome,
          awayTeamId: creatingAway,
        })
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
      setCreatingHome(null);
      setCreatingAway(null);
      toast({
        title: "Fixture created",
        description: "6 rubbers seeded automatically.",
      });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message,
        variant: "destructive",
      }),
  });

  const unassigned = fixtures.filter((f) => f.court == null);
  const byCourt: Record<number, any[]> = {};
  COURTS.forEach((c) => {
    byCourt[c] = fixtures.filter((f) => f.court === c);
  });

  const onDrop = (court: number | null) => (e: React.DragEvent) => {
    e.preventDefault();
    if (draggedId != null) setCourt.mutate({ id: draggedId, court });
    setDraggedId(null);
  };

  return (
    <div
      className="min-h-screen text-white pb-24"
      style={{ background: BSL.bgDeep }}
    >
      <BSLBackground />
      <div className="max-w-7xl mx-auto px-4 md:px-8 pt-8">
        <Link href="/">
          <a
            className="inline-flex items-center gap-2 text-xs uppercase tracking-widest mb-4"
            style={{ color: BSL.muted }}
          >
            <ArrowLeft className="h-3 w-3" /> Back to BSL
          </a>
        </Link>
        <h1 className="text-3xl md:text-5xl font-black uppercase tracking-tight mb-2">
          Fixture <span style={{ color: BSL.gold }}>Board</span>
        </h1>
        <p className="text-sm mb-6" style={{ color: BSL.muted }}>
          Drag fixtures onto a court. Drop back into "Unassigned" to clear.
        </p>

        <GlowPanel
          title="Create Fixture"
          tone="cyan"
          icon={<Plus className="h-4 w-4" />}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
            <div>
              <label
                className="text-[10px] uppercase tracking-widest font-bold mb-2 block"
                style={{ color: BSL.muted }}
              >
                Home Team
              </label>
              <select
                value={creatingHome ?? ""}
                onChange={(e) =>
                  setCreatingHome(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="w-full px-3 py-2 rounded-lg text-white outline-none"
                style={{
                  background: "hsla(0,0%,100%,0.05)",
                  border: `1px solid hsla(0,0%,100%,0.15)`,
                }}
                data-testid="select-home"
              >
                <option value="">Pick team...</option>
                {teams.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.division})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                className="text-[10px] uppercase tracking-widest font-bold mb-2 block"
                style={{ color: BSL.muted }}
              >
                Away Team
              </label>
              <select
                value={creatingAway ?? ""}
                onChange={(e) =>
                  setCreatingAway(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
                className="w-full px-3 py-2 rounded-lg text-white outline-none"
                style={{
                  background: "hsla(0,0%,100%,0.05)",
                  border: `1px solid hsla(0,0%,100%,0.15)`,
                }}
                data-testid="select-away"
              >
                <option value="">Pick team...</option>
                {teams
                  .filter((t: any) => t.id !== creatingHome)
                  .map((t: any) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.division})
                    </option>
                  ))}
              </select>
            </div>
            <ActionButton
              variant="cyan"
              onClick={() => create.mutate()}
              loading={create.isPending}
              disabled={
                !creatingHome || !creatingAway || creatingHome === creatingAway
              }
              icon={<Plus className="h-4 w-4" />}
            >
              Create
            </ActionButton>
          </div>
        </GlowPanel>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mt-5">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop(null)}
            className="lg:col-span-1"
          >
            <GlowPanel
              title="Unassigned"
              subtitle={`${unassigned.length}`}
              tone="gold"
              icon={<Calendar className="h-4 w-4" />}
            >
              <div className="space-y-2 min-h-[200px]">
                {unassigned.length === 0 && (
                  <div
                    className="text-xs py-8 text-center"
                    style={{ color: BSL.muted }}
                  >
                    Drop fixtures here
                  </div>
                )}
                {unassigned.map((f) => (
                  <FixtureChip
                    key={f.id}
                    f={f}
                    onDragStart={() => setDraggedId(f.id)}
                  />
                ))}
              </div>
            </GlowPanel>
          </div>
          <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {COURTS.map((c) => (
              <div
                key={c}
                onDragOver={(e) => e.preventDefault()}
                onDrop={onDrop(c)}
              >
                <GlowPanel
                  title={`Court ${c}`}
                  subtitle={`${byCourt[c].length} fixture${byCourt[c].length !== 1 ? "s" : ""}`}
                  tone="cyan"
                  icon={<Activity className="h-4 w-4" />}
                >
                  <div className="space-y-2 min-h-[150px]">
                    {byCourt[c].length === 0 && (
                      <div
                        className="text-xs py-6 text-center"
                        style={{ color: BSL.muted }}
                      >
                        Drop here
                      </div>
                    )}
                    {byCourt[c].map((f) => (
                      <FixtureChip
                        key={f.id}
                        f={f}
                        onDragStart={() => setDraggedId(f.id)}
                      />
                    ))}
                  </div>
                </GlowPanel>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FixtureChip({ f, onDragStart }: { f: any; onDragStart: () => void }) {
  return (
    <motion.div
      draggable
      onDragStart={onDragStart}
      whileHover={{ scale: 1.02 }}
      whileDrag={{ scale: 1.06, boxShadow: `0 24px 60px -10px ${BSL.gold}66` }}
      className="rounded-lg p-2.5 cursor-grab active:cursor-grabbing"
      style={{
        background: "hsla(0,0%,100%,0.05)",
        border: `1px solid ${BSL.gold}33`,
      }}
      data-testid={`fixture-chip-${f.id}`}
    >
      <div className="flex items-center justify-between text-xs">
        <Link href={`/match/${f.id}`} className="font-semibold truncate hover:underline">
          {f.homeTeamName}
        </Link>
        <span
          className="font-black tabular-nums px-1.5"
          style={{ color: BSL.gold }}
        >
          {f.homeRubbers}–{f.awayRubbers}
        </span>
        <Link href={`/match/${f.id}`} className="font-semibold truncate hover:underline">
          {f.awayTeamName}
        </Link>
      </div>
      <div
        className="text-[10px] uppercase tracking-widest mt-1"
        style={{ color: BSL.muted }}
      >
        {f.status}
      </div>
    </motion.div>
  );
}
