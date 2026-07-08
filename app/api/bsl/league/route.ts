import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslLeagues, bslLeagueDays } from "@/lib/server/schema";
import { eq, desc, and, or, sql, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function GET(_req: NextRequest) {
  try {
    const [league] = await db
      .select()
      .from(bslLeagues)
      .where(eq(bslLeagues.id, 1))
      .limit(1);
    if (!league)
      return Response.json(
        { message: "League not configured" },
        { status: 404 },
      );
    const now = new Date();
    const upcoming = await db
      .select()
      .from(bslLeagueDays)
      .where(eq(bslLeagueDays.bslLeagueId, 1))
      .orderBy(bslLeagueDays.date);
    const futureDay = upcoming.find(
      (d) =>
        d.date &&
        d.state !== "CLOSED" &&
        new Date(d.date).getTime() > now.getTime(),
    );
    const liveDay = upcoming.find((d) => d.date && d.state !== "CLOSED");
    const stored = league.nextLeagueDay ? new Date(league.nextLeagueDay) : null;
    const storedStillFuture = stored && stored.getTime() > now.getTime();
    const effectiveNext = futureDay?.date
      ? new Date(futureDay.date)
      : storedStillFuture
        ? stored
        : liveDay?.date
          ? new Date(liveDay.date)
          : null;
    return Response.json({ ...league, nextLeagueDay: effectiveNext });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const body = (await req.json()) || {};
    const allowedStr = [
      "name",
      "tagline",
      "venueName",
      "bankAccountName",
      "bankSortCode",
      "bankAccountNumber",
      "matchFormat",
      "brandingPrimary",
      "brandingAccent",
    ];
    const allowedInt = [
      "clubFee",
      "playerFee",
      "pointsWin",
      "pointsDraw",
      "pointsLoss",
      "courtCount",
      "divisionJoinFeePence",
    ];
    const update: Record<string, any> = { updatedAt: new Date() };
    if ("divisions" in body) {
      const raw = Array.isArray(body.divisions) ? body.divisions : [];
      const cleaned = Array.from(
        new Set(
          raw
            .map((s: any) =>
              String(s ?? "")
                .trim()
                .slice(0, 56),
            )
            .filter((s: string) => s.length > 0),
        ),
      ).slice(0, 32);
      update.divisions = cleaned;
    }
    for (const k of allowedStr) {
      if (k in body)
        update[k] = body[k] === null ? null : String(body[k] ?? "");
    }
    for (const k of allowedInt) {
      if (k in body) {
        const n = Number(body[k]);
        if (Number.isFinite(n)) update[k] = Math.max(0, Math.round(n));
      }
    }
    if ("notificationsEnabled" in body)
      update.notificationsEnabled = !!body.notificationsEnabled;
    if ("playerGrades" in body) {
      const raw = Array.isArray(body.playerGrades) ? body.playerGrades : [];
      const seen = new Set<string>();
      const cleaned: any[] = [];
      for (const r of raw) {
        if (!r || typeof r !== "object") continue;
        const code = String((r as any).code ?? "")
          .trim()
          .toUpperCase()
          .slice(0, 12);
        if (!code || seen.has(code)) continue;
        seen.add(code);
        const label =
          String((r as any).label ?? code)
            .trim()
            .slice(0, 24) || code;
        const sortOrder = Number.isFinite(Number((r as any).sortOrder))
          ? Number((r as any).sortOrder)
          : cleaned.length;
        cleaned.push({ code, label, sortOrder });
        if (cleaned.length >= 32) break;
      }
      cleaned.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      update.playerGrades = cleaned;
    }
    if (
      "divisionGrades" in body &&
      body.divisionGrades &&
      typeof body.divisionGrades === "object"
    ) {
      const [current] = await db
        .select()
        .from(bslLeagues)
        .where(eq(bslLeagues.id, 1))
        .limit(1);
      const knownDivisions = new Set<string>(
        [
          ...(current?.divisions || []),
          ...((Array.isArray(body.divisions)
            ? body.divisions
            : []) as string[]),
        ].map((s) => String(s)),
      );
      const out: Record<string, string[]> = {};
      for (const [k, v] of Object.entries(
        body.divisionGrades as Record<string, any>,
      )) {
        if (knownDivisions.size && !knownDivisions.has(k)) continue;
        if (!Array.isArray(v)) continue;
        out[k] = Array.from(
          new Set(
            v
              .map((g: any) => String(g).trim().toUpperCase())
              .filter((g: string) => g.length),
          ),
        ).slice(0, 32);
      }
      update.divisionGrades = out;
    }
    if ("topupPackages" in body) {
      const raw = Array.isArray(body.topupPackages) ? body.topupPackages : [];
      const seen = new Set<string>();
      const cleaned: any[] = [];
      for (const r of raw) {
        if (!r || typeof r !== "object") continue;
        const id =
          String(r.id ?? "")
            .trim()
            .slice(0, 40) || `pkg_${cleaned.length + 1}`;
        if (seen.has(id)) continue;
        seen.add(id);
        const label = String(r.label ?? "")
          .trim()
          .slice(0, 56);
        const amt = Math.max(
          0,
          Math.min(1_000_000, Math.round(Number(r.amountPence))),
        );
        if (!label || !Number.isFinite(amt)) continue;
        const sortOrder = Number.isFinite(Number(r.sortOrder))
          ? Number(r.sortOrder)
          : cleaned.length;
        cleaned.push({ id, label, amountPence: amt, sortOrder });
        if (cleaned.length >= 24) break;
      }
      cleaned.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
      update.topupPackages = cleaned;
    }
    if ("topupDiscountPcts" in body) {
      const raw = Array.isArray(body.topupDiscountPcts)
        ? body.topupDiscountPcts
        : [];
      update.topupDiscountPcts = raw.slice(0, 12).map((v: any) => {
        const n = Number(v);
        return Number.isFinite(n)
          ? Math.min(100, Math.max(0, Math.round(n)))
          : 0;
      });
    }
    if (
      "categoryFees" in body &&
      body.categoryFees &&
      typeof body.categoryFees === "object"
    ) {
      const cleaned: Record<string, number> = {};
      for (const cat of ["MD", "WD", "XD"]) {
        const n = Number((body.categoryFees as any)[cat]);
        if (Number.isFinite(n)) cleaned[cat] = Math.max(0, Math.round(n));
      }
      if (Object.keys(cleaned).length > 0) update.categoryFees = cleaned;
    }
    if ("nextLeagueDay" in body) {
      const v = body.nextLeagueDay;
      if (!v) update.nextLeagueDay = null;
      else {
        const d = v instanceof Date ? v : new Date(v);
        if (!isNaN(d.getTime())) update.nextLeagueDay = d;
      }
    }
    const [updated] = await db
      .update(bslLeagues)
      .set(update as any)
      .where(eq(bslLeagues.id, 1))
      .returning();
    if (!updated) {
      const [created] = await db
        .insert(bslLeagues)
        .values({ id: 1, ...update } as any)
        .returning();
      return Response.json(created);
    }
    return Response.json(updated);
  } catch (err: any) {
    return Response.json(
      { message: err.message || "Failed to save settings" },
      { status: 500 },
    );
  }
}
