import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslPlayers,
  bslWalletTransactions,
  bslLeagues,
} from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { audit, genRef } from "@/lib/server/utils";
import { computeTopup } from "@/lib/topupPricing";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const body = await req.json();
    const [p] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (!p)
      return Response.json(
        { message: "BSL player not found" },
        { status: 404 },
      );

    const [league] = await db
      .select()
      .from(bslLeagues)
      .where(eq(bslLeagues.id, 1))
      .limit(1);
    const packages = ((league as any)?.topupPackages || []) as Array<{
      id: string;
      label: string;
      amountPence: number;
    }>;
    const discountPcts = ((league as any)?.topupDiscountPcts || [
      0, 50, 70,
    ]) as number[];

    let clickHistory: string[] = [];
    const rawHistory = body.clickHistory;
    if (typeof rawHistory === "string" && rawHistory.length) {
      try {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed))
          clickHistory = parsed.map((s: any) => String(s)).slice(0, 200);
      } catch {
        /* ignore */
      }
    } else if (Array.isArray(rawHistory)) {
      clickHistory = rawHistory.map((s: any) => String(s)).slice(0, 200);
    }
    const customRaw = Number(body.customAmountPence);
    const customPence = Number.isFinite(customRaw)
      ? Math.max(0, Math.min(1_000_000, Math.round(customRaw)))
      : 0;

    let amount: number;
    let description: string;
    if (clickHistory.length || customPence > 0) {
      const summary = computeTopup(
        clickHistory,
        packages,
        discountPcts,
        customPence,
      );
      amount = summary.totalPence;
      const partsByPkg = new Map<string, number>();
      for (const l of summary.lines)
        partsByPkg.set(l.packageId, (partsByPkg.get(l.packageId) || 0) + 1);
      const labelById = new Map(packages.map((pkg) => [pkg.id, pkg.label]));
      const parts = Array.from(partsByPkg.entries()).map(
        ([id, qty]) => `${qty}× ${labelById.get(id) ?? id}`,
      );
      if (customPence > 0)
        parts.push(`Custom £${(customPence / 100).toFixed(2)}`);
      if (summary.discountPence > 0)
        parts.push(`(−£${(summary.discountPence / 100).toFixed(2)} discount)`);
      description = parts.join(" · ") || "Wallet top-up";
    } else {
      amount = Math.trunc(Number(body.amount));
      description = body.description || "Wallet top-up";
    }
    if (
      !Number.isFinite(amount) ||
      !Number.isInteger(amount) ||
      amount <= 0 ||
      amount > 1_000_000
    ) {
      return Response.json(
        { message: "Total must be a positive integer in pence (max £10,000)" },
        { status: 400 },
      );
    }

    const reference = genRef("BSL-TOPUP");
    const paymentDate = String(body.paymentDate || "").trim();
    const payerAccountName = String(body.payerAccountName || "")
      .trim()
      .slice(0, 120);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate))
      return Response.json(
        { message: "Enter the date you sent the transfer (YYYY-MM-DD)." },
        { status: 400 },
      );
    if (payerAccountName.length < 2)
      return Response.json(
        { message: "Enter the bank account name you paid from." },
        { status: 400 },
      );
    const [tx] = await db
      .insert(bslWalletTransactions)
      .values({
        bslPlayerId: p.id,
        type: "TOPUP",
        amount,
        reference,
        paymentDate,
        payerAccountName,
        description,
      } as any)
      .returning();
    await audit(
      user,
      "WALLET_TOPUP_REQUESTED",
      "bsl_wallet_transactions",
      tx.id,
      { amount },
    );
    return Response.json(tx);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
