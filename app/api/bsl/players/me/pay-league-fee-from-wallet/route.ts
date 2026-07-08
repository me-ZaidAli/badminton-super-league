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
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT id, status, wallet_balance FROM bsl_players WHERE user_id = ${user.id} LIMIT 1 FOR UPDATE`,
      );
      const row: any = (locked as any).rows?.[0];
      if (!row)
        throw Object.assign(new Error("No BSL player profile"), {
          status: 404,
        });
      if (row.status === "ACTIVE")
        throw Object.assign(new Error("League fee already paid"), {
          status: 409,
        });
      const [league] = await tx
        .select()
        .from(bslLeagues)
        .where(eq(bslLeagues.id, 1))
        .limit(1);
      const fee = league?.playerFee || 0;
      if (fee <= 0)
        throw Object.assign(new Error("No league fee configured"), {
          status: 400,
        });
      const balance = Number(row.wallet_balance ?? 0);
      if (balance < fee)
        throw Object.assign(
          new Error(
            `Insufficient balance — need £${(fee / 100).toFixed(2)}, have £${(balance / 100).toFixed(2)}`,
          ),
          { status: 400 },
        );
      const newBalance = balance - fee;
      await tx
        .update(bslPlayers)
        .set({
          status: "ACTIVE",
          approvedAt: new Date(),
          walletBalance: newBalance,
        })
        .where(eq(bslPlayers.id, row.id));
      const [txRow] = await tx
        .insert(bslWalletTransactions)
        .values({
          bslPlayerId: row.id,
          type: "DEDUCTION",
          amount: fee,
          status: "APPROVED",
          reference: genRef("BSL-FEE"),
          description: "League registration fee",
          reviewedById: user.id,
          reviewedAt: new Date(),
        })
        .returning();
      return { playerId: row.id, walletAfter: newBalance, fee, txRow };
    });
    await audit(user, "PLAYER_PAY_LEAGUE_FEE", "bsl_players", result.playerId, {
      feePence: result.fee,
      walletAfterPence: result.walletAfter,
    });
    return Response.json({ ok: true, ...result });
  } catch (err: any) {
    const status = err?.status || 500;
    return Response.json({ message: err.message }, { status });
  }
}
