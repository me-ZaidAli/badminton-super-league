import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslWalletTransactions } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit, genRef } from "@/lib/server/utils";
import { sql } from "drizzle-orm";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const delta = Math.trunc(Number(body.deltaPence));
    if (!Number.isFinite(delta) || delta === 0)
      return Response.json(
        { message: "deltaPence must be a non-zero integer" },
        { status: 400 },
      );
    const result = await db.transaction(async (tx) => {
      const locked = await tx.execute(
        sql`SELECT id, wallet_balance FROM bsl_players WHERE id = ${id} LIMIT 1 FOR UPDATE`,
      );
      const row: any = (locked as any).rows?.[0];
      if (!row)
        throw Object.assign(new Error("Player not found"), { status: 404 });
      const newBalance = Number(row.wallet_balance || 0) + delta;
      if (newBalance < 0)
        throw Object.assign(
          new Error(
            `Would result in negative balance (current: ${row.wallet_balance}, delta: ${delta})`,
          ),
          { status: 400 },
        );
      await tx
        .update(bslPlayers)
        .set({ walletBalance: newBalance })
        .where(eq(bslPlayers.id, id));
      const [txRow] = await tx
        .insert(bslWalletTransactions)
        .values({
          bslPlayerId: id,
          type: delta > 0 ? "TOPUP" : "DEDUCTION",
          amount: Math.abs(delta),
          status: "APPROVED",
          reference: genRef("BSL-ADJ"),
          description: body.description || `Admin wallet adjustment`,
          reviewedById: user.id,
          reviewedAt: new Date(),
        })
        .returning();
      return { newBalance, txRow };
    });
    await audit(user, "ADMIN_WALLET_ADJUST", "bsl_players", id, {
      delta,
      newBalance: result.newBalance,
      description: body.description,
    });
    return Response.json({
      walletBalance: result.newBalance,
      transaction: result.txRow,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return Response.json({ message: err.message }, { status });
  }
}
