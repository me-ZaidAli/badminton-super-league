import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslWalletTransactions, bslPlayers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import { sql } from "drizzle-orm";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT t.*, p.wallet_balance FROM bsl_wallet_transactions t JOIN bsl_players p ON p.id = t.bsl_player_id WHERE t.id = ${id} FOR UPDATE`,
      );
      const row: any = (locked as any).rows?.[0];
      if (!row)
        throw Object.assign(new Error("Transaction not found"), {
          status: 404,
        });
      if (row.status !== "PENDING")
        throw Object.assign(new Error("Transaction already processed"), {
          status: 409,
        });
      if (row.type !== "TOPUP")
        throw Object.assign(
          new Error("Only TOPUP transactions can be approved here"),
          { status: 400 },
        );
      const newBal = Number(row.wallet_balance) + row.amount;
      await tx
        .update(bslPlayers)
        .set({ walletBalance: newBal })
        .where(eq(bslPlayers.id, row.bsl_player_id));
      const [updated] = await tx
        .update(bslWalletTransactions)
        .set({
          status: "APPROVED",
          reviewedById: user.id,
          reviewedAt: new Date(),
        })
        .where(eq(bslWalletTransactions.id, id))
        .returning();
      return { updated, newBalance: newBal };
    });
    await audit(user, "WALLET_TOPUP_APPROVED", "bsl_wallet_transactions", id, {
      newBalance: result.newBalance,
    });
    return Response.json({
      transaction: result.updated,
      walletBalance: result.newBalance,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return Response.json({ message: err.message }, { status });
  }
}
