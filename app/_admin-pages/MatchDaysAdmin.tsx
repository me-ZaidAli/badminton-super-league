import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays,
  MapPin,
  Users,
  Plus,
  X,
  Trash2,
  Save,
  ExternalLink,
  Settings2,
  Activity,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Link } from "@/lib/routing";

const STATE_TONE: Record<string, { c: string; label: string }> = {
  DRAFT: { c: BSL.muted, label: "Draft" },
  PUBLISHED: { c: BSL.cyan, label: "Published" },
  LIVE: { c: BSL.gold, label: "LIVE" },
  CLOSED: { c: BSL.success, label: "Closed" },
};

function fmtLocal(iso: string | Date) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function clean(msg?: string) {
  return (msg || "").replace(/^\d{3}:\s*/, "");
}

export default function MatchDaysAdmin() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: days } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/league-days"],
  });
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const { data: clubs } = useQuery<any[]>({
    queryKey: ["/api/bsl/admin/clubs"],
  });
  const [openId, setOpenId] = useState<number | null>(null);

  // Quick-create form
  const [newDate, setNewDate] = useState("");
  const [newVenue, setNewVenue] = useState("");
  const [newDivision, setNewDivision] = useState("");
  const addDay = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/bsl/admin/league-days", {
          date: newDate,
          venue: newVenue || null,
          division: newDivision || null,
        })
      ).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/league-days"] });
      setNewDate("");
      setNewVenue("");
      setNewDivision("");
      toast({ title: "Match day added" });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't add",
        description: clean(e?.message),
        variant: "destructive",
      }),
  });

  // Local-time day key so a match day flips to "Past" at local midnight, not UTC.
  const dayKey = (v: string | Date) => {
    const d = new Date(v);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };
  const todayKey = (() => {
    const n = new Date();
    const pad = (x: number) => String(x).padStart(2, "0");
    return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
  })();
  const upcoming = useMemo(
    () =>
      (days || [])
        .filter((d) => dayKey(d.date) >= todayKey)
        .slice()
        .sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        ),
    [days, todayKey],
  );
  const past = useMemo(
    () =>
      (days || [])
        .filter((d) => dayKey(d.date) < todayKey)
        .slice()
        .sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
        ),
    [days, todayKey],
  );
  const [dayTab, setDayTab] = useState<"upcoming" | "past">(() => {
    const saved = localStorage.getItem("matchDaysTab");
    if (saved === "upcoming" || saved === "past") return saved;
    return "upcoming";
  });
  useEffect(() => {
    localStorage.setItem("matchDaysTab", dayTab);
  }, [dayTab]);
  const shownDays = dayTab === "upcoming" ? upcoming : past;

  return (
    <AdminLayout active="match-days">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            Match <span style={{ color: BSL.cyan }}>Days</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: BSL.muted }}>
            Every match day — click any card to edit date, venue, teams, rules,
            rubbers and everything else.
          </p>
        </div>
      </div>

      <GlowPanel
        title="Add a match day"
        subtitle="Date is required — everything else is editable later"
        tone="cyan"
        icon={<Plus className="h-4 w-4" />}
      >
        <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <input
            type="datetime-local"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="input-md-new-date"
          />
          <input
            placeholder="Venue (optional)"
            value={newVenue}
            onChange={(e) => setNewVenue(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="input-md-new-venue"
          />
          <select
            value={newDivision}
            onChange={(e) => setNewDivision(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm"
            style={{
              background: BSL.cardSoft,
              border: `1px solid ${BSL.border}`,
              color: "white",
            }}
            data-testid="select-md-new-division"
          >
            <option value="">All divisions</option>
            {(league?.divisions || []).map((d: string) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <ActionButton
            variant="cyan"
            onClick={() => newDate && addDay.mutate()}
            disabled={!newDate || addDay.isPending}
            icon={<Plus className="h-3 w-3" />}
          >
            Add
          </ActionButton>
        </div>
      </GlowPanel>

      <div className="h-5" />

      <GlowPanel
        title="All match days"
        subtitle={`${upcoming.length} upcoming · ${past.length} past · click any card to edit everything`}
        tone="gold"
        icon={<CalendarDays className="h-4 w-4" />}
        collapsible
        defaultOpen
      >
        <div className="flex items-center gap-2 mb-4">
          {(
            [
              ["upcoming", `Upcoming (${upcoming.length})`],
              ["past", `Past (${past.length})`],
            ] as const
          ).map(([key, label]) => {
            const active = dayTab === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setDayTab(key)}
                className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition"
                style={{
                  background: active ? `${BSL.cyan}22` : "transparent",
                  color: active ? BSL.cyan : BSL.muted,
                  border: `1px solid ${active ? BSL.cyan : BSL.border}`,
                }}
                data-testid={`tab-match-days-${key}`}
              >
                {label}
              </button>
            );
          })}
        </div>
        {!shownDays.length ? (
          <div
            className="py-10 text-center text-sm"
            style={{ color: BSL.muted }}
          >
            {dayTab === "upcoming"
              ? "No upcoming match days."
              : "No past match days."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {shownDays.map((d, i) => {
              const state = (d.state || "DRAFT").toUpperCase();
              const tone = STATE_TONE[state] || STATE_TONE.DRAFT;
              return (
                <motion.button
                  key={d.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ y: -2 }}
                  onClick={() => setOpenId(d.id)}
                  className="text-left p-4 rounded-xl transition-all"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                  }}
                  data-testid={`card-match-day-${d.id}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] uppercase tracking-widest font-black px-1.5 py-0.5 rounded"
                      style={{ background: `${tone.c}22`, color: tone.c }}
                    >
                      {tone.label}
                    </span>
                    {d.rubbersPerFixture ? (
                      <span
                        className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded"
                        style={{ background: `${BSL.gold}22`, color: BSL.gold }}
                      >
                        {d.rubbersPerFixture} rubbers
                      </span>
                    ) : null}
                  </div>
                  <div className="text-lg font-black">
                    {new Date(d.date).toLocaleDateString("en-GB", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </div>
                  <div className="text-xs mt-0.5" style={{ color: BSL.muted }}>
                    {new Date(d.date).toLocaleTimeString("en-GB", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                  {d.venue && (
                    <div
                      className="text-xs mt-2 inline-flex items-center gap-1"
                      style={{ color: BSL.cyan }}
                    >
                      <MapPin className="h-3 w-3" />
                      {d.venue}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-3 flex-wrap text-[10px]">
                    {d.division && (
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{ background: `${BSL.cyan}22`, color: BSL.cyan }}
                      >
                        {d.division}
                      </span>
                    )}
                    {d.category && (
                      <span
                        className="px-1.5 py-0.5 rounded"
                        style={{ background: `${BSL.gold}22`, color: BSL.gold }}
                      >
                        {d.category}
                      </span>
                    )}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </GlowPanel>

      <AnimatePresence>
        {openId != null && (
          <MatchDayEditor
            id={openId}
            league={league}
            clubs={clubs || []}
            onClose={() => setOpenId(null)}
          />
        )}
      </AnimatePresence>
    </AdminLayout>
  );
}

function MatchDayEditor({
  id,
  league,
  clubs,
  onClose,
}: {
  id: number;
  league: any;
  clubs: any[];
  onClose: () => void;
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<{ day: any; fixtures: any[] }>({
    queryKey: ["/api/bsl/admin/league-days", id, "details"],
    queryFn: async () =>
      (
        await apiRequest("GET", `/api/bsl/admin/league-days/${id}/details`)
      ).json(),
  });
  const day = data?.day;
  const fixtures = data?.fixtures || [];
  const state = (day?.state || "DRAFT").toUpperCase();
  const isLocked = state === "LIVE" || state === "CLOSED";

  const refetchAll = () => {
    qc.invalidateQueries({
      queryKey: ["/api/bsl/admin/league-days", id, "details"],
    });
    qc.invalidateQueries({ queryKey: ["/api/bsl/admin/league-days"] });
    qc.invalidateQueries({ queryKey: ["/api/bsl/fixtures"] });
  };

  const patchDay = useMutation({
    mutationFn: async (patch: any) =>
      (
        await apiRequest("PATCH", `/api/bsl/admin/league-days/${id}`, patch)
      ).json(),
    onSuccess: () => {
      refetchAll();
      toast({ title: "Match day saved" });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't save",
        description: clean(e?.message),
        variant: "destructive",
      }),
  });
  const setState = useMutation({
    mutationFn: async (next: string) =>
      (
        await apiRequest("PATCH", `/api/bsl/admin/league-days/${id}/state`, {
          state: next,
        })
      ).json(),
    onSuccess: (_, next) => {
      refetchAll();
      toast({ title: `State → ${next}` });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't change state",
        description: clean(e?.message),
        variant: "destructive",
      }),
  });
  const delDay = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("DELETE", `/api/bsl/admin/league-days/${id}`, {})
      ).json(),
    onSuccess: () => {
      refetchAll();
      toast({ title: "Match day removed" });
      onClose();
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't delete",
        description: clean(e?.message),
        variant: "destructive",
      }),
  });
  const patchFixture = useMutation({
    mutationFn: async ({ fid, patch }: { fid: number; patch: any }) =>
      (await apiRequest("PATCH", `/api/bsl/fixtures/${fid}`, patch)).json(),
    onSuccess: () => {
      refetchAll();
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't update fixture",
        description: clean(e?.message),
        variant: "destructive",
      }),
  });
  // Two-phase delete: try without force; if the server says "force required"
  // (FINISHED status or any raw rubber score), prompt the admin again and
  // retry with ?force=true. Backend is the source of truth on what counts as
  // "scored" — frontend aggregate (homeRubbers/awayRubbers) misses raw
  // mid-match scores, so we always defer to the server message.
  async function runDeleteFixture(fid: number, label: string) {
    const tryDelete = async (force: boolean) => {
      const r = await fetch(
        `/api/bsl/admin/fixtures/${fid}${force ? "?force=true" : ""}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      return {
        ok: r.ok,
        status: r.status,
        body: await r.json().catch(() => ({})),
      };
    };
    if (!confirm(`Delete fixture: ${label}?`)) return;
    let resp = await tryDelete(false);
    if (
      !resp.ok &&
      resp.status === 400 &&
      /force=true/i.test(resp.body?.message || "")
    ) {
      if (!confirm(`${resp.body.message}\n\nDelete anyway?`)) return;
      resp = await tryDelete(true);
    }
    if (!resp.ok) {
      toast({
        title: "Couldn't delete fixture",
        description: clean(resp.body?.message) || `HTTP ${resp.status}`,
        variant: "destructive",
      });
      return;
    }
    refetchAll();
    toast({ title: "Fixture deleted" });
  }
  const addFixture = useMutation({
    mutationFn: async () =>
      (
        await apiRequest("POST", "/api/bsl/admin/club-fixtures", {
          homeClubId: clubs[0]?.id,
          awayClubId: clubs[1]?.id,
          leagueDayId: id,
          category: day?.category || "MD",
        })
      ).json(),
    onSuccess: () => {
      refetchAll();
      toast({ title: "Fixture added — assign clubs in the row" });
    },
    onError: (e: any) =>
      toast({
        title: "Couldn't add fixture",
        description: clean(e?.message),
        variant: "destructive",
      }),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-3xl max-h-[92vh] overflow-y-auto p-0"
        style={{
          background: BSL.bgDeep,
          border: `1px solid ${BSL.border}`,
          color: "white",
        }}
      >
        <DialogHeader
          className="px-5 pt-5 pb-3 border-b"
          style={{ borderColor: BSL.border }}
        >
          <DialogTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
            <Settings2 className="h-5 w-5" style={{ color: BSL.cyan }} />
            Edit Match Day
          </DialogTitle>
          <p className="text-xs" style={{ color: BSL.muted }}>
            Date is always editable — division/category/rubbers locked once
            LIVE/CLOSED.
          </p>
        </DialogHeader>

        {isLoading || !day ? (
          <div className="p-8 text-center text-sm" style={{ color: BSL.muted }}>
            Loading…
          </div>
        ) : (
          <div className="p-5 space-y-5">
            {/* === LIFECYCLE STATE === */}
            <div
              className="flex items-center gap-2 flex-wrap p-3 rounded-xl"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
              }}
            >
              <span
                className="text-[10px] uppercase tracking-widest font-bold"
                style={{ color: BSL.muted }}
              >
                State:
              </span>
              {(["DRAFT", "PUBLISHED", "LIVE", "CLOSED"] as const).map((s) => {
                const active = state === s;
                const tone = STATE_TONE[s];
                return (
                  <button
                    key={s}
                    onClick={() => !active && setState.mutate(s)}
                    disabled={setState.isPending || active}
                    className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider transition disabled:opacity-50"
                    style={{
                      background: active ? `${tone.c}33` : "transparent",
                      color: active ? tone.c : "white",
                      border: `1px solid ${active ? tone.c : BSL.border}`,
                    }}
                    data-testid={`button-state-${s.toLowerCase()}`}
                  >
                    {tone.label}
                  </button>
                );
              })}
            </div>

            {/* === CORE FIELDS === */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Date & time">
                <input
                  type="datetime-local"
                  defaultValue={fmtLocal(day.date)}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v) patchDay.mutate({ date: new Date(v).toISOString() });
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inp()}
                  data-testid="input-edit-date"
                />
              </Field>
              <Field label="Venue / location">
                <input
                  defaultValue={day.venue || ""}
                  placeholder="e.g. Edgbaston Priory Club, Court 1"
                  onBlur={(e) => {
                    if ((e.target.value || null) !== (day.venue || null))
                      patchDay.mutate({ venue: e.target.value || null });
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={inp()}
                  data-testid="input-edit-venue"
                />
              </Field>
              <Field
                label="Division"
                hint={isLocked ? "Locked while LIVE/CLOSED" : undefined}
              >
                <select
                  defaultValue={day.division || ""}
                  disabled={isLocked}
                  onChange={(e) =>
                    patchDay.mutate({ division: e.target.value || null })
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                  style={inp()}
                  data-testid="select-edit-division"
                >
                  <option value="">All divisions</option>
                  {(league?.divisions || []).map((d: string) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
              <Field
                label="Category"
                hint={isLocked ? "Locked while LIVE/CLOSED" : undefined}
              >
                <select
                  defaultValue={day.category || ""}
                  disabled={isLocked}
                  onChange={(e) =>
                    patchDay.mutate({ category: e.target.value || null })
                  }
                  className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                  style={inp()}
                  data-testid="select-edit-category"
                >
                  <option value="">Mixed (no category)</option>
                  <option value="MD">MD — Men's Doubles</option>
                  <option value="WD">WD — Women's Doubles</option>
                  <option value="XD">XD — Mixed Doubles</option>
                  <option value="MS1">MS1</option>
                  <option value="MS2">MS2</option>
                  <option value="WS">WS</option>
                </select>
              </Field>
              <Field
                label="Rubbers per fixture"
                hint={
                  isLocked
                    ? "Locked while LIVE/CLOSED"
                    : "Blank = use category default"
                }
              >
                <input
                  type="number"
                  min={1}
                  max={60}
                  defaultValue={day.rubbersPerFixture ?? ""}
                  disabled={isLocked}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    const next =
                      raw === ""
                        ? null
                        : Math.max(1, Math.min(60, Math.round(Number(raw))));
                    if (next !== (day.rubbersPerFixture ?? null))
                      patchDay.mutate({ rubbersPerFixture: next });
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm tabular-nums disabled:opacity-50"
                  style={inp()}
                  data-testid="input-edit-rubbers"
                />
              </Field>
              <Field
                label="Legacy status (UPCOMING/LIVE/COMPLETED)"
                hint="Display label only — use State buttons above for the lifecycle."
              >
                <select
                  defaultValue={day.status || "UPCOMING"}
                  disabled={isLocked}
                  onChange={(e) => patchDay.mutate({ status: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm disabled:opacity-50"
                  style={inp()}
                  data-testid="select-edit-status"
                >
                  <option value="UPCOMING">UPCOMING</option>
                  <option value="LIVE">LIVE</option>
                  <option value="COMPLETED">COMPLETED</option>
                </select>
              </Field>
              <Field
                label="Challenge Zone · Max matches"
                hint="Maximum inter-club challenge matches that can be booked on this day. Blank = unlimited."
              >
                <input
                  type="number"
                  min={0}
                  max={200}
                  defaultValue={day.maxMatches ?? ""}
                  onBlur={(e) => {
                    const raw = e.target.value;
                    const next =
                      raw === ""
                        ? null
                        : Math.max(0, Math.min(200, Math.round(Number(raw))));
                    if (next !== (day.maxMatches ?? null))
                      patchDay.mutate({ maxMatches: next });
                  }}
                  className="w-full px-3 py-2 rounded-lg text-sm tabular-nums"
                  style={inp()}
                  data-testid="input-edit-max-matches"
                />
              </Field>
            </div>

            <Field label="Notes (admin / public)">
              <textarea
                defaultValue={day.notes || ""}
                rows={2}
                placeholder="Anything players need to know — parking, format, dress code…"
                onBlur={(e) => {
                  if ((e.target.value || null) !== (day.notes || null))
                    patchDay.mutate({ notes: e.target.value || null });
                }}
                className="w-full px-3 py-2 rounded-lg text-sm resize-y"
                style={inp()}
                data-testid="input-edit-notes"
              />
            </Field>

            {/* === FIXTURES ON THIS DAY === */}
            <div
              className="rounded-xl p-3 space-y-3"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
              }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" style={{ color: BSL.cyan }} />
                  <h3 className="text-sm font-black uppercase tracking-wider">
                    Teams playing ({fixtures.length})
                  </h3>
                </div>
                <button
                  onClick={() => {
                    if (!clubs || clubs.length < 2) {
                      toast({
                        title: "Need at least 2 clubs first",
                        variant: "destructive",
                      });
                      return;
                    }
                    addFixture.mutate();
                  }}
                  disabled={addFixture.isPending || isLocked}
                  className="text-[11px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md font-bold uppercase tracking-wider disabled:opacity-50"
                  style={{
                    background: `${BSL.cyan}22`,
                    color: BSL.cyan,
                    border: `1px solid ${BSL.cyan}55`,
                  }}
                  data-testid="button-add-fixture"
                >
                  <Plus className="h-3 w-3" /> Add fixture
                </button>
              </div>
              {fixtures.length === 0 ? (
                <div
                  className="py-6 text-center text-xs"
                  style={{ color: BSL.muted }}
                >
                  No fixtures on this day yet. Add one or use League Control to
                  auto-generate.
                </div>
              ) : (
                <div className="space-y-2">
                  {fixtures.map((f) => (
                    <FixtureRow
                      key={f.id}
                      f={f}
                      clubs={clubs}
                      disabled={isLocked}
                      onPatch={(patch) =>
                        patchFixture.mutate({ fid: f.id, patch })
                      }
                      onDelete={() => {
                        const home =
                          clubs.find((c: any) => c.id === f.homeClubId)?.name ||
                          "Home";
                        const away =
                          clubs.find((c: any) => c.id === f.awayClubId)?.name ||
                          "Away";
                        runDeleteFixture(f.id, `${home} vs ${away}`);
                      }}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* === DANGER ZONE === */}
            <div
              className="flex items-center justify-between pt-3 border-t"
              style={{ borderColor: BSL.border }}
            >
              <Link href="/admin/match-day">
                <a
                  className="text-xs inline-flex items-center gap-1"
                  style={{ color: BSL.cyan }}
                >
                  <Activity className="h-3 w-3" /> Open Match Day Control
                </a>
              </Link>
              <button
                onClick={() => {
                  if (
                    confirm(
                      "Delete this match day? Fixtures attached will be unlinked.",
                    )
                  )
                    delDay.mutate();
                }}
                disabled={delDay.isPending || isLocked}
                className="text-xs inline-flex items-center gap-1 px-2.5 py-1 rounded-md disabled:opacity-50"
                style={{
                  background: `${BSL.danger}22`,
                  color: BSL.danger,
                  border: `1px solid ${BSL.danger}55`,
                }}
                data-testid="button-delete-day"
              >
                <Trash2 className="h-3 w-3" /> Delete match day
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FixtureRow({
  f,
  clubs,
  disabled,
  onPatch,
  onDelete,
}: {
  f: any;
  clubs: any[];
  disabled: boolean;
  onPatch: (p: any) => void;
  onDelete?: () => void;
}) {
  const dt = f.startTime ? fmtLocal(f.startTime) : "";
  // Expand each club into one entry per division it participates in (primary
  // + additionalDivisions) so a club in N divisions shows N times. Value is
  // `${clubId}|${division}` — parsed on change to set the fixture's division
  // alongside the club id.
  type Opt = { clubId: number; name: string; division: string; value: string };
  const opts: Opt[] = [];
  (clubs || []).forEach((c: any) => {
    const divs = new Set<string>();
    if (c.division) divs.add(c.division);
    (Array.isArray(c.additionalDivisions) ? c.additionalDivisions : []).forEach(
      (d: string) => {
        if (d) divs.add(d);
      },
    );
    if (divs.size === 0) divs.add("—");
    divs.forEach((d) =>
      opts.push({
        clubId: c.id,
        name: c.name,
        division: d,
        value: `${c.id}|${d}`,
      }),
    );
  });
  opts.sort(
    (a, b) =>
      a.division.localeCompare(b.division) || a.name.localeCompare(b.name),
  );
  const homeValue = f.homeClubId ? `${f.homeClubId}|${f.division || ""}` : "";
  const awayValue = f.awayClubId ? `${f.awayClubId}|${f.division || ""}` : "";
  function parse(v: string) {
    if (!v)
      return { clubId: null as number | null, division: null as string | null };
    const [c, d] = v.split("|");
    return { clubId: Number(c) || null, division: d || null };
  }
  return (
    <div
      className="grid grid-cols-1 md:grid-cols-[1fr_1fr_120px_120px_auto_auto] gap-2 items-center p-2 rounded-lg"
      style={{ background: BSL.card, border: `1px solid ${BSL.border}` }}
      data-testid={`row-fixture-${f.id}`}
    >
      <select
        defaultValue={homeValue}
        disabled={disabled}
        onChange={(e) => {
          const p = parse(e.target.value);
          onPatch({ homeClubId: p.clubId, division: p.division });
        }}
        className="px-2 py-1.5 rounded-md text-xs disabled:opacity-50"
        style={inp()}
        data-testid={`select-home-${f.id}`}
      >
        <option value="">— Home club —</option>
        {opts.map((o) => (
          <option key={`h-${o.value}`} value={o.value}>
            {o.name} ({o.division})
          </option>
        ))}
      </select>
      <select
        defaultValue={awayValue}
        disabled={disabled}
        onChange={(e) => {
          const p = parse(e.target.value);
          onPatch({ awayClubId: p.clubId, division: p.division });
        }}
        className="px-2 py-1.5 rounded-md text-xs disabled:opacity-50"
        style={inp()}
        data-testid={`select-away-${f.id}`}
      >
        <option value="">— Away club —</option>
        {opts.map((o) => (
          <option key={`a-${o.value}`} value={o.value}>
            {o.name} ({o.division})
          </option>
        ))}
      </select>
      <input
        type="number"
        min={1}
        max={64}
        placeholder="Court"
        defaultValue={f.court ?? ""}
        disabled={disabled}
        onBlur={(e) => {
          const raw = e.target.value;
          const next =
            raw === ""
              ? null
              : Math.max(1, Math.min(64, Math.round(Number(raw))));
          if (next !== (f.court ?? null)) onPatch({ court: next });
        }}
        className="px-2 py-1.5 rounded-md text-xs tabular-nums disabled:opacity-50"
        style={inp()}
        data-testid={`input-court-${f.id}`}
      />
      <input
        type="datetime-local"
        defaultValue={dt}
        disabled={disabled}
        onBlur={(e) => {
          const v = e.target.value;
          if (v && v !== dt) onPatch({ startTime: new Date(v).toISOString() });
        }}
        className="px-2 py-1.5 rounded-md text-xs disabled:opacity-50"
        style={inp()}
        data-testid={`input-time-${f.id}`}
      />
      <Link href={`/admin/fixtures/${f.id}/setup`}>
        <a
          className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded-md font-bold uppercase tracking-wider whitespace-nowrap"
          style={{
            background: `${BSL.gold}22`,
            color: BSL.gold,
            border: `1px solid ${BSL.gold}55`,
          }}
          data-testid={`link-setup-${f.id}`}
        >
          <ExternalLink className="h-3 w-3" /> Pairs
        </a>
      </Link>
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={disabled}
          title={disabled ? "Locked while LIVE/CLOSED" : "Delete this fixture"}
          className="p-1.5 rounded-md disabled:opacity-40 hover:opacity-80"
          style={{
            background: `${BSL.danger}22`,
            color: BSL.danger,
            border: `1px solid ${BSL.danger}55`,
          }}
          data-testid={`button-delete-fixture-${f.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="text-[10px] uppercase tracking-widest font-bold block mb-1"
        style={{ color: BSL.muted }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div className="text-[10px] mt-1" style={{ color: BSL.faint }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function inp(): React.CSSProperties {
  return {
    background: BSL.bgDeep,
    border: `1px solid ${BSL.border}`,
    color: "white",
  };
}
