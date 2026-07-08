import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Settings as SettingsIcon,
  Save,
  Banknote,
  Trophy,
  Bell,
  Palette,
  Wallet as WalletIcon,
  Plus,
  Trash2,
  Award,
  Layers,
  Edit3,
} from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { GlowPanel } from "@/components/bsl/GlowPanel";
import { ActionButton } from "@/components/bsl/ActionButton";
import { BSL } from "@/components/bsl/BSLPalette";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function SettingsAdmin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: league } = useQuery<any>({ queryKey: ["/api/bsl/league"] });
  const [form, setForm] = useState<any>({});

  useEffect(() => {
    if (league)
      setForm({
        name: league.name ?? "",
        tagline: league.tagline ?? "",
        venueName: league.venueName ?? "",
        bankAccountName: league.bankAccountName ?? "",
        bankSortCode: league.bankSortCode ?? "",
        bankAccountNumber: league.bankAccountNumber ?? "",
        // Fees stored in pence on the server, edited in pounds here (no leading zeros)
        clubFeePounds:
          league.clubFee != null ? String(league.clubFee / 100) : "",
        playerFeePounds:
          league.playerFee != null ? String(league.playerFee / 100) : "",
        pointsWin: league.pointsWin ?? 3,
        pointsDraw: league.pointsDraw ?? 1,
        pointsLoss: league.pointsLoss ?? 0,
        feeMD:
          league.categoryFees?.MD != null
            ? String(league.categoryFees.MD / 100)
            : "",
        feeWD:
          league.categoryFees?.WD != null
            ? String(league.categoryFees.WD / 100)
            : "",
        feeXD:
          league.categoryFees?.XD != null
            ? String(league.categoryFees.XD / 100)
            : "",
        divisionJoinFeePounds:
          league.divisionJoinFeePence != null
            ? String(league.divisionJoinFeePence / 100)
            : "25",
        matchFormat: league.matchFormat ?? "6-RUBBER",
        courtCount: league.courtCount ?? 6,
        notificationsEnabled: !!league.notificationsEnabled,
        brandingPrimary: league.brandingPrimary ?? "",
        brandingAccent: league.brandingAccent ?? "",
        nextLeagueDay: league.nextLeagueDay
          ? toLocalInput(league.nextLeagueDay)
          : "",
        // Top-up config — packages stored in pence on the server, edited as £ here.
        topupPackages: Array.isArray(league.topupPackages)
          ? league.topupPackages.map((p: any, i: number) => ({
              id: String(p.id || `pkg_${i + 1}`),
              label: String(p.label || ""),
              amountPounds:
                p.amountPence != null
                  ? String((p.amountPence / 100).toFixed(2)).replace(
                      /\.00$/,
                      "",
                    )
                  : "",
            }))
          : [],
        topupDiscountPcts:
          Array.isArray(league.topupDiscountPcts) &&
          league.topupDiscountPcts.length
            ? league.topupDiscountPcts.map((n: any) => String(n))
            : ["0", "50", "70"],
        // Grade catalogue — admin-defined player ranks (e.g. A1/A2/B1…). Edited as
        // free-form rows; sortOrder = row index. Falls back to the seeded default
        // shape so a new league still ships with a sensible list.
        playerGrades:
          Array.isArray(league.playerGrades) && league.playerGrades.length
            ? league.playerGrades.map((g: any) => ({
                code: String(g.code || "").toUpperCase(),
                label: String(g.label || g.code || ""),
              }))
            : [],
        // Division → allowed-grades restriction map. Empty list per division = no
        // restriction (any grade may join). Stored as a flat object keyed by
        // division name and re-keyed automatically when divisions are renamed.
        divisionGrades:
          league.divisionGrades && typeof league.divisionGrades === "object"
            ? league.divisionGrades
            : {},
      });
  }, [league]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, any> = {
        name: form.name,
        tagline: form.tagline,
        venueName: form.venueName,
        bankAccountName: form.bankAccountName,
        bankSortCode: form.bankSortCode,
        bankAccountNumber: form.bankAccountNumber,
        pointsWin: numOrUndef(form.pointsWin),
        pointsDraw: numOrUndef(form.pointsDraw),
        pointsLoss: numOrUndef(form.pointsLoss),
        matchFormat: form.matchFormat,
        courtCount: numOrUndef(form.courtCount),
        notificationsEnabled: !!form.notificationsEnabled,
        brandingPrimary: form.brandingPrimary,
        brandingAccent: form.brandingAccent,
      };
      // Convert pounds → pence, drop blanks
      const cf = parseFloat(form.clubFeePounds);
      const pf = parseFloat(form.playerFeePounds);
      if (Number.isFinite(cf)) payload.clubFee = Math.round(cf * 100);
      if (Number.isFinite(pf)) payload.playerFee = Math.round(pf * 100);
      // Division-join fee (deducted from the manager's wallet when their club
      // joins another division). Empty string = leave unchanged.
      const dj = parseFloat(form.divisionJoinFeePounds);
      if (Number.isFinite(dj))
        payload.divisionJoinFeePence = Math.max(0, Math.round(dj * 100));
      // Per-category fees (only send when at least one is set)
      const md = parseFloat(form.feeMD),
        wd = parseFloat(form.feeWD),
        xd = parseFloat(form.feeXD);
      if ([md, wd, xd].some(Number.isFinite)) {
        payload.categoryFees = {
          MD: Number.isFinite(md)
            ? Math.round(md * 100)
            : (league?.categoryFees?.MD ?? 2500),
          WD: Number.isFinite(wd)
            ? Math.round(wd * 100)
            : (league?.categoryFees?.WD ?? 2500),
          XD: Number.isFinite(xd)
            ? Math.round(xd * 100)
            : (league?.categoryFees?.XD ?? 3000),
        };
      }
      // Top-up packages — convert pounds → pence, drop blanks/zero rows.
      if (Array.isArray(form.topupPackages)) {
        payload.topupPackages = form.topupPackages
          .map((p: any, i: number) => {
            const pounds = parseFloat(p.amountPounds);
            const label = String(p.label || "").trim();
            if (!label || !Number.isFinite(pounds) || pounds < 0) return null;
            return {
              id: p.id || `pkg_${i + 1}`,
              label,
              amountPence: Math.round(pounds * 100),
              sortOrder: i,
            };
          })
          .filter(Boolean);
      }
      // Discount tiers — strings to numbers, clamp 0..100, drop NaNs.
      if (Array.isArray(form.topupDiscountPcts)) {
        payload.topupDiscountPcts = form.topupDiscountPcts
          .map((s: any) => {
            const n = Number(s);
            return Number.isFinite(n)
              ? Math.min(100, Math.max(0, Math.round(n)))
              : null;
          })
          .filter((n: any) => n !== null);
      }
      // Player grade catalogue — keep only rows with a code, dedupe upper-case.
      if (Array.isArray(form.playerGrades)) {
        const seen = new Set<string>();
        payload.playerGrades = form.playerGrades
          .map((g: any, i: number) => {
            const code = String(g.code || "")
              .trim()
              .toUpperCase();
            if (!code || seen.has(code)) return null;
            seen.add(code);
            return {
              code,
              label: String(g.label || code).trim() || code,
              sortOrder: i,
            };
          })
          .filter(Boolean);
      }
      // Division eligibility map — keep only known divisions, store unique grade codes.
      if (form.divisionGrades && typeof form.divisionGrades === "object") {
        const known = new Set<string>(league?.divisions || []);
        const out: Record<string, string[]> = {};
        for (const [k, v] of Object.entries(
          form.divisionGrades as Record<string, any>,
        )) {
          if (!known.has(k)) continue;
          if (Array.isArray(v))
            out[k] = Array.from(
              new Set(
                v.map((s: any) => String(s).toUpperCase()).filter(Boolean),
              ),
            );
        }
        payload.divisionGrades = out;
      }
      // Convert datetime-local string → ISO; only send when non-empty
      if (form.nextLeagueDay)
        payload.nextLeagueDay = new Date(form.nextLeagueDay).toISOString();
      // Strip undefined keys so the server doesn't try to write them
      Object.keys(payload).forEach(
        (k) => payload[k] === undefined && delete payload[k],
      );
      const r = await apiRequest("PATCH", "/api/bsl/league", payload);
      const txt = await r.text();
      return txt ? JSON.parse(txt) : null;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/league"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) =>
      toast({
        title: "Failed",
        description: e.message || "Could not save",
        variant: "destructive",
      }),
  });

  const F = (k: string, v: any) => setForm({ ...form, [k]: v });

  // Cascading division rename — atomic on the server (clubs + teams + league
  // days + prizes + the league's own divisions array + divisionGrades key).
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(
    null,
  );
  const renameDivision = useMutation({
    mutationFn: async (v: { from: string; to: string }) =>
      (await apiRequest("POST", "/api/bsl/admin/divisions/rename", v)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bsl/league"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/admin/clubs"] });
      qc.invalidateQueries({ queryKey: ["/api/bsl/standings"] });
      setRenaming(null);
      toast({ title: "Division renamed everywhere" });
    },
    onError: (e: any) =>
      toast({
        title: "Rename failed",
        description: e.message?.replace(/^\d+:\s*/, ""),
        variant: "destructive",
      }),
  });

  return (
    <AdminLayout active="settings">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tight">
            League <span style={{ color: BSL.gold }}>Settings</span>
          </h1>
          <p className="text-sm mt-1" style={{ color: BSL.muted }}>
            Rules · branding · bank details · notifications
          </p>
        </div>
        <ActionButton
          variant="gold"
          onClick={() => save.mutate()}
          disabled={save.isPending}
          icon={<Save className="h-3 w-3" />}
        >
          {save.isPending ? "Saving…" : "Save changes"}
        </ActionButton>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <GlowPanel
          title="Identity"
          tone="gold"
          icon={<SettingsIcon className="h-4 w-4" />}
        >
          <Field label="League name">
            <Input
              value={form.name || ""}
              onChange={(v) => F("name", v)}
              testid="input-league-name"
            />
          </Field>
          <Field label="Tagline">
            <Input
              value={form.tagline || ""}
              onChange={(v) => F("tagline", v)}
              testid="input-tagline"
            />
          </Field>
          <Field label="Venue">
            <Input
              value={form.venueName || ""}
              onChange={(v) => F("venueName", v)}
              testid="input-venue"
            />
          </Field>
          <Field label="Next league day">
            <Input
              type="datetime-local"
              value={form.nextLeagueDay || ""}
              onChange={(v) => F("nextLeagueDay", v)}
              testid="input-next-day"
            />
          </Field>
        </GlowPanel>

        <GlowPanel
          title="Match Rules"
          tone="cyan"
          icon={<Trophy className="h-4 w-4" />}
        >
          <Field label="Match format">
            <select
              value={form.matchFormat || "6-RUBBER"}
              onChange={(e) => F("matchFormat", e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="select-format"
            >
              <option value="6-RUBBER">
                6-Rubber (MS×2 / WS / MD / WD / XD)
              </option>
              <option value="9-RUBBER">9-Rubber extended</option>
              <option value="3-SET">3-Set best-of</option>
            </select>
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Win pts">
              <NumberInput
                value={form.pointsWin}
                onChange={(v) => F("pointsWin", v)}
                placeholder="3"
                testid="input-pts-win"
              />
            </Field>
            <Field label="Draw pts">
              <NumberInput
                value={form.pointsDraw}
                onChange={(v) => F("pointsDraw", v)}
                placeholder="1"
                testid="input-pts-draw"
              />
            </Field>
            <Field label="Loss pts">
              <NumberInput
                value={form.pointsLoss}
                onChange={(v) => F("pointsLoss", v)}
                placeholder="0"
                testid="input-pts-loss"
              />
            </Field>
          </div>
          <Field label="Courts available">
            <NumberInput
              value={form.courtCount}
              onChange={(v) => F("courtCount", v)}
              placeholder="6"
              testid="input-courts"
            />
          </Field>
        </GlowPanel>

        <GlowPanel
          title="Bank Transfer Details"
          tone="gold"
          icon={<Banknote className="h-4 w-4" />}
        >
          <Field label="Account name">
            <Input
              value={form.bankAccountName || ""}
              onChange={(v) => F("bankAccountName", v)}
              testid="input-bank-name"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sort code">
              <Input
                value={form.bankSortCode || ""}
                onChange={(v) => F("bankSortCode", v)}
                testid="input-sort"
              />
            </Field>
            <Field label="Account number">
              <Input
                value={form.bankAccountNumber || ""}
                onChange={(v) => F("bankAccountNumber", v)}
                testid="input-acct"
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Club fee (£)">
              <MoneyInput
                value={form.clubFeePounds}
                onChange={(v) => F("clubFeePounds", v)}
                placeholder="500"
                testid="input-club-fee"
              />
            </Field>
            <Field label="Player fee (£)">
              <MoneyInput
                value={form.playerFeePounds}
                onChange={(v) => F("playerFeePounds", v)}
                placeholder="25"
                testid="input-player-fee"
              />
            </Field>
          </div>
          <div className="text-xs mt-2" style={{ color: BSL.muted }}>
            Currently:{" "}
            <span style={{ color: BSL.gold }}>
              £{fmtPounds(form.clubFeePounds)} per club
            </span>{" "}
            ·{" "}
            <span style={{ color: BSL.gold }}>
              £{fmtPounds(form.playerFeePounds)} per player
            </span>
          </div>
          <div
            className="mt-4 pt-4"
            style={{ borderTop: `1px solid ${BSL.border}` }}
          >
            <div
              className="text-[10px] uppercase tracking-widest font-black mb-2"
              style={{ color: BSL.gold }}
            >
              Per-category fees (£)
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Men's Doubles">
                <MoneyInput
                  value={form.feeMD}
                  onChange={(v: any) => F("feeMD", v)}
                  placeholder="25"
                  testid="input-fee-md"
                />
              </Field>
              <Field label="Women's Doubles">
                <MoneyInput
                  value={form.feeWD}
                  onChange={(v: any) => F("feeWD", v)}
                  placeholder="25"
                  testid="input-fee-wd"
                />
              </Field>
              <Field label="Mixed Doubles">
                <MoneyInput
                  value={form.feeXD}
                  onChange={(v: any) => F("feeXD", v)}
                  placeholder="30"
                  testid="input-fee-xd"
                />
              </Field>
            </div>
            <div className="text-xs mt-1" style={{ color: BSL.muted }}>
              Players pay this from their BSL wallet on category registration.
              Falls back to player fee if blank.
            </div>
          </div>
          <div
            className="mt-4 pt-4"
            style={{ borderTop: `1px solid ${BSL.border}` }}
          >
            <div
              className="text-[10px] uppercase tracking-widest font-black mb-2"
              style={{ color: BSL.gold }}
            >
              Division join fee (£)
            </div>
            <Field label="Per additional division">
              <MoneyInput
                value={form.divisionJoinFeePounds}
                onChange={(v: any) => F("divisionJoinFeePounds", v)}
                placeholder="25"
                testid="input-division-join-fee"
              />
            </Field>
            <div className="text-xs mt-1" style={{ color: BSL.muted }}>
              Charged to the club admin's BSL wallet each time their club joins
              another division. Set to 0 to make additional divisions free.
            </div>
          </div>
        </GlowPanel>

        <GlowPanel
          title="Wallet Top-Up Packages"
          tone="gold"
          icon={<WalletIcon className="h-4 w-4" />}
        >
          <div className="text-xs mb-3" style={{ color: BSL.muted }}>
            Buttons shown to players in the wallet top-up modal. Each click adds
            the amount to the running total. Players can press the same package
            multiple times — discounts apply by click order.
          </div>
          <div className="space-y-2 mb-3">
            {(form.topupPackages || []).map((p: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2"
                data-testid={`row-topup-pkg-${i}`}
              >
                <input
                  type="text"
                  value={p.label}
                  placeholder="e.g. Adult"
                  onChange={(e) => {
                    const next = [...form.topupPackages];
                    next[i] = { ...next[i], label: e.target.value };
                    F("topupPackages", next);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                    color: "white",
                  }}
                  data-testid={`input-topup-label-${i}`}
                />
                <div className="relative w-32">
                  <span
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: BSL.muted }}
                  >
                    £
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    value={p.amountPounds}
                    placeholder="20"
                    onChange={(e) => {
                      const next = [...form.topupPackages];
                      next[i] = {
                        ...next[i],
                        amountPounds: e.target.value.replace(/^0+(?=\d)/, ""),
                      };
                      F("topupPackages", next);
                    }}
                    className="w-full pl-7 pr-2 py-2 rounded-lg text-sm"
                    style={{
                      background: BSL.cardSoft,
                      border: `1px solid ${BSL.border}`,
                      color: "white",
                    }}
                    data-testid={`input-topup-amount-${i}`}
                  />
                </div>
                <button
                  onClick={() =>
                    F(
                      "topupPackages",
                      form.topupPackages.filter((_: any, j: number) => j !== i),
                    )
                  }
                  className="p-2 rounded-lg hover:bg-white/10"
                  style={{ color: BSL.danger }}
                  data-testid={`button-topup-remove-${i}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              F("topupPackages", [
                ...(form.topupPackages || []),
                { id: `pkg_${Date.now()}`, label: "", amountPounds: "" },
              ])
            }
            className="w-full px-3 py-2 rounded-lg text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-1.5"
            style={{
              background: `${BSL.gold}11`,
              border: `1px dashed ${BSL.gold}66`,
              color: BSL.gold,
            }}
            data-testid="button-topup-add-package"
          >
            <Plus className="h-3 w-3" /> Add package
          </button>
          <div
            className="mt-4 pt-4"
            style={{ borderTop: `1px solid ${BSL.border}` }}
          >
            <div
              className="text-[10px] uppercase tracking-widest font-black mb-2"
              style={{ color: BSL.gold }}
            >
              Discount ladder (% off Nth selection)
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(form.topupDiscountPcts || []).map((v: string, i: number) => (
                <div key={i}>
                  <div
                    className="text-[10px] uppercase tracking-widest font-bold mb-1"
                    style={{ color: BSL.muted }}
                  >
                    {ordinal(i + 1)} pick
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={v}
                      onChange={(e) => {
                        const next = [...form.topupDiscountPcts];
                        next[i] = e.target.value.replace(/^0+(?=\d)/, "");
                        F("topupDiscountPcts", next);
                      }}
                      className="w-full pr-6 pl-2 py-2 rounded-lg text-sm"
                      style={{
                        background: BSL.cardSoft,
                        border: `1px solid ${BSL.border}`,
                        color: "white",
                      }}
                      data-testid={`input-discount-${i}`}
                    />
                    <span
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-sm"
                      style={{ color: BSL.muted }}
                    >
                      %
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="text-xs mt-2" style={{ color: BSL.muted }}>
              Default: 1st full · 2nd 50% off · 3rd 70% off · 4th+ full again.
              Empty list = no discounts.
            </div>
          </div>
        </GlowPanel>

        <GlowPanel
          title="Player Grades"
          tone="cyan"
          icon={<Award className="h-4 w-4" />}
        >
          <div className="text-xs mb-3" style={{ color: BSL.muted }}>
            Admin-defined grade catalogue. Each player's grade controls which
            divisions they can join.
          </div>
          <div className="space-y-2 mb-3">
            {(form.playerGrades || []).map((g: any, i: number) => (
              <div
                key={i}
                className="flex items-center gap-2"
                data-testid={`row-grade-${i}`}
              >
                <input
                  type="text"
                  value={g.code}
                  placeholder="A1"
                  onChange={(e) => {
                    const next = [...form.playerGrades];
                    next[i] = {
                      ...next[i],
                      code: e.target.value.toUpperCase().slice(0, 12),
                    };
                    F("playerGrades", next);
                  }}
                  className="w-24 px-3 py-2 rounded-lg text-sm font-mono font-bold"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                    color: BSL.cyan,
                  }}
                  data-testid={`input-grade-code-${i}`}
                />
                <input
                  type="text"
                  value={g.label}
                  placeholder="Display label"
                  onChange={(e) => {
                    const next = [...form.playerGrades];
                    next[i] = {
                      ...next[i],
                      label: e.target.value.slice(0, 24),
                    };
                    F("playerGrades", next);
                  }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                    color: "white",
                  }}
                  data-testid={`input-grade-label-${i}`}
                />
                <button
                  onClick={() =>
                    F(
                      "playerGrades",
                      form.playerGrades.filter((_: any, j: number) => j !== i),
                    )
                  }
                  className="p-2 rounded-lg hover:bg-white/10"
                  style={{ color: BSL.danger }}
                  data-testid={`button-grade-remove-${i}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() =>
              F("playerGrades", [
                ...(form.playerGrades || []),
                { code: "", label: "" },
              ])
            }
            className="w-full px-3 py-2 rounded-lg text-xs uppercase tracking-widest font-bold flex items-center justify-center gap-1.5"
            style={{
              background: `${BSL.cyan}11`,
              border: `1px dashed ${BSL.cyan}66`,
              color: BSL.cyan,
            }}
            data-testid="button-grade-add"
          >
            <Plus className="h-3 w-3" /> Add grade
          </button>
          <div className="text-[10px] mt-2" style={{ color: BSL.muted }}>
            Default: A1 · A2 · B1 · B2 · C1 · C2 · C3.
          </div>
        </GlowPanel>

        <GlowPanel
          title="Divisions & Eligibility"
          tone="gold"
          icon={<Layers className="h-4 w-4" />}
        >
          <div className="text-xs mb-3" style={{ color: BSL.muted }}>
            Rename divisions in place (cascades through clubs, teams, league
            days, prizes — preserves all IDs). Per-division grade restrictions
            block ineligible players from joining.
          </div>
          <div className="space-y-3">
            {((league?.divisions as string[]) || []).map((divName) => {
              const allowed: string[] = (form.divisionGrades?.[divName] ||
                []) as string[];
              const allCodes: string[] = (form.playerGrades || [])
                .map((g: any) => g.code)
                .filter(Boolean);
              return (
                <div
                  key={divName}
                  className="p-3 rounded-lg"
                  style={{
                    background: BSL.cardSoft,
                    border: `1px solid ${BSL.border}`,
                  }}
                  data-testid={`row-division-${divName}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className="font-black text-sm uppercase tracking-tight"
                      style={{ color: BSL.gold }}
                    >
                      {divName}
                    </div>
                    <button
                      onClick={() =>
                        setRenaming({ from: divName, to: divName })
                      }
                      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold px-2 py-1 rounded"
                      style={{
                        background: `${BSL.cyan}1f`,
                        color: BSL.cyan,
                        border: `1px solid ${BSL.cyan}55`,
                      }}
                      data-testid={`button-rename-${divName}`}
                    >
                      <Edit3 className="h-3 w-3" /> Rename
                    </button>
                  </div>
                  <div
                    className="text-[10px] uppercase tracking-widest font-bold mb-1.5"
                    style={{ color: BSL.muted }}
                  >
                    Allowed grades
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {allCodes.length === 0 ? (
                      <div className="text-[10px]" style={{ color: BSL.faint }}>
                        Define grades above to start restricting.
                      </div>
                    ) : (
                      allCodes.map((code) => {
                        const on = allowed.includes(code);
                        return (
                          <button
                            key={code}
                            onClick={() => {
                              const next = { ...(form.divisionGrades || {}) };
                              const cur: string[] = next[divName] || [];
                              next[divName] = on
                                ? cur.filter((c) => c !== code)
                                : [...cur, code];
                              F("divisionGrades", next);
                            }}
                            className="px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest"
                            style={{
                              background: on ? `${BSL.gold}33` : BSL.card,
                              color: on ? BSL.gold : BSL.muted,
                              border: `1px solid ${on ? BSL.gold : BSL.border}`,
                            }}
                            data-testid={`toggle-divgrade-${divName}-${code}`}
                          >
                            {code}
                          </button>
                        );
                      })
                    )}
                  </div>
                  <div
                    className="text-[10px] mt-2"
                    style={{ color: BSL.faint }}
                  >
                    {allowed.length === 0
                      ? "No restriction — any grade may join."
                      : `Only ${allowed.join(" / ")} may join.`}
                  </div>
                </div>
              );
            })}
            {(!league?.divisions || league.divisions.length === 0) && (
              <div className="text-xs" style={{ color: BSL.muted }}>
                No divisions configured yet — add some via the Competition page.
              </div>
            )}
          </div>
        </GlowPanel>

        <GlowPanel
          title="Notifications & Branding"
          tone="cyan"
          icon={<Bell className="h-4 w-4" />}
        >
          <button
            onClick={() =>
              F("notificationsEnabled", !form.notificationsEnabled)
            }
            className="flex items-center justify-between p-3 rounded-lg text-sm font-bold w-full mb-3"
            style={{
              background: form.notificationsEnabled
                ? `${BSL.cyan}22`
                : BSL.cardSoft,
              border: `1px solid ${form.notificationsEnabled ? BSL.cyan : BSL.border}`,
              color: form.notificationsEnabled ? BSL.cyan : BSL.muted,
            }}
            data-testid="toggle-notif"
          >
            <span className="inline-flex items-center gap-2">
              <Bell className="h-3.5 w-3.5" /> Push notifications
            </span>
            {form.notificationsEnabled ? "ON" : "OFF"}
          </button>
          <div
            className="text-[10px] uppercase tracking-widest font-black mb-2 flex items-center gap-1.5"
            style={{ color: BSL.gold }}
          >
            <Palette className="h-3 w-3" /> Branding overrides
          </div>
          <Field label="Primary color (hsl)">
            <Input
              value={form.brandingPrimary || ""}
              onChange={(v) => F("brandingPrimary", v)}
              testid="input-brand-primary"
            />
          </Field>
          <Field label="Accent color (hsl)">
            <Input
              value={form.brandingAccent || ""}
              onChange={(v) => F("brandingAccent", v)}
              testid="input-brand-accent"
            />
          </Field>
          <div className="flex gap-2 mt-2">
            <div
              className="flex-1 h-10 rounded-lg"
              style={{ background: form.brandingPrimary || BSL.gold }}
            />
            <div
              className="flex-1 h-10 rounded-lg"
              style={{ background: form.brandingAccent || BSL.cyan }}
            />
          </div>
        </GlowPanel>
      </div>

      {renaming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{
            background: "hsla(222,60%,2%,0.85)",
            backdropFilter: "blur(8px)",
          }}
          onClick={() => !renameDivision.isPending && setRenaming(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ background: BSL.card, border: `1px solid ${BSL.cyan}55` }}
            onClick={(e) => e.stopPropagation()}
            data-testid="dialog-rename-division"
          >
            <h3 className="text-lg font-black uppercase tracking-tight mb-1">
              Rename division
            </h3>
            <p className="text-xs mb-4" style={{ color: BSL.muted }}>
              Updates every reference (clubs, teams, league days, prizes,
              eligibility map) inside one transaction. Existing IDs and
              standings are preserved.
            </p>
            <div
              className="text-[10px] uppercase tracking-widest font-bold mb-1"
              style={{ color: BSL.muted }}
            >
              From
            </div>
            <div
              className="px-3 py-2 rounded-lg text-sm font-bold mb-3"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: BSL.gold,
              }}
            >
              {renaming.from}
            </div>
            <div
              className="text-[10px] uppercase tracking-widest font-bold mb-1"
              style={{ color: BSL.muted }}
            >
              To
            </div>
            <input
              autoFocus
              type="text"
              value={renaming.to}
              onChange={(e) =>
                setRenaming({ ...renaming, to: e.target.value.slice(0, 56) })
              }
              className="w-full px-3 py-2 rounded-lg text-sm mb-4"
              style={{
                background: BSL.cardSoft,
                border: `1px solid ${BSL.border}`,
                color: "white",
              }}
              data-testid="input-rename-to"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenaming(null)}
                disabled={renameDivision.isPending}
                className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest"
                style={{ background: BSL.cardSoft, color: BSL.muted }}
                data-testid="button-cancel-rename"
              >
                Cancel
              </button>
              <ActionButton
                variant="cyan"
                onClick={() => renameDivision.mutate(renaming)}
                disabled={
                  !renaming.to.trim() ||
                  renaming.from === renaming.to.trim() ||
                  renameDivision.isPending
                }
                testid="button-confirm-rename"
              >
                {renameDivision.isPending ? "Renaming…" : "Rename everywhere"}
              </ActionButton>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Field({ label, children }: any) {
  return (
    <div className="mb-3">
      <label
        className="text-[10px] uppercase tracking-widest font-bold block mb-1"
        style={{ color: BSL.muted }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
function Input({ value, onChange, type = "text", placeholder, testid }: any) {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-3 py-2 rounded-lg text-sm"
      style={{
        background: BSL.cardSoft,
        border: `1px solid ${BSL.border}`,
        color: "white",
      }}
      data-testid={testid}
    />
  );
}
// Integer input that allows empty values and never shows leading zeros.
function NumberInput({ value, onChange, placeholder, testid }: any) {
  const display =
    value === null || value === undefined || value === "" ? "" : String(value);
  return (
    <input
      type="number"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "") return onChange(undefined);
        // Strip leading zeros (but keep a single 0)
        const cleaned = v.replace(/^0+(?=\d)/, "");
        const n = parseInt(cleaned, 10);
        onChange(Number.isFinite(n) ? n : undefined);
      }}
      className="w-full px-3 py-2 rounded-lg text-sm"
      style={{
        background: BSL.cardSoft,
        border: `1px solid ${BSL.border}`,
        color: "white",
      }}
      data-testid={testid}
    />
  );
}
// Money input in pounds — stores a clean string, no forced leading zeros.
function MoneyInput({ value, onChange, placeholder, testid }: any) {
  return (
    <input
      type="number"
      inputMode="decimal"
      step="0.01"
      min="0"
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === "") return onChange("");
        // Strip leading zeros except for "0." style decimals
        const cleaned = raw.replace(/^0+(?=\d)/, "");
        onChange(cleaned);
      }}
      className="w-full px-3 py-2 rounded-lg text-sm"
      style={{
        background: BSL.cardSoft,
        border: `1px solid ${BSL.border}`,
        color: "white",
      }}
      data-testid={testid}
    />
  );
}
function numOrUndef(v: any): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
function fmtPounds(v: any): string {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n.toFixed(2) : "0.00";
}
function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
function toLocalInput(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
