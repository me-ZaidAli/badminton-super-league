import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslPlayers,
  bslLeagues,
  bslWalletTransactions,
} from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { audit, genRef } from "@/lib/server/utils";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const body = await req.json();
    const category = String(body.category || "").toUpperCase();
    const ALLOWED = new Set(["MD", "WD", "XD"]);
    if (!ALLOWED.has(category))
      return Response.json(
        { message: "category must be MD, WD, or XD" },
        { status: 400 },
      );
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (!me)
      return Response.json(
        { message: "No BSL player profile yet" },
        { status: 404 },
      );
    const cur = (me.categories || []) as string[];
    if (cur.includes(category))
      return Response.json(
        { message: "Already registered for this category" },
        { status: 409 },
      );
    const [league] = await db
      .select()
      .from(bslLeagues)
      .where(eq(bslLeagues.id, 1))
      .limit(1);
    const catFees: Record<string, number> = (league as any)?.categoryFees || {};
    const fee = catFees[category] || 0;
    if (fee > 0) {
      const bal = me.walletBalance || 0;
      if (bal < fee)
        return Response.json(
          {
            message: `Insufficient wallet balance — need £${(fee / 100).toFixed(2)}, have £${(bal / 100).toFixed(2)}. Top up first.`,
          },
          { status: 400 },
        );
      await db
        .update(bslPlayers)
        .set({ walletBalance: bal - fee, categories: [...cur, category] })
        .where(eq(bslPlayers.id, me.id));
      await db
        .insert(bslWalletTransactions)
        .values({
          bslPlayerId: me.id,
          type: "DEDUCTION",
          amount: fee,
          status: "APPROVED",
          reference: genRef("BSL-CAT"),
          description: `Category registration · ${category}`,
          reviewedById: user.id,
          reviewedAt: new Date(),
        });
    } else {
      await db
        .update(bslPlayers)
        .set({ categories: [...cur, category] })
        .where(eq(bslPlayers.id, me.id));
    }
    await audit(user, "PLAYER_ADD_CATEGORY", "bsl_players", me.id, {
      category,
      feePence: fee,
    });
    const [updated] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.id, me.id))
      .limit(1);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
