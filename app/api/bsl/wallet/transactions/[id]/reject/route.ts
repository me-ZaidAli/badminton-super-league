import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslWalletTransactions } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

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
    const body = await req.json();
    const [tx] = await db
      .select()
      .from(bslWalletTransactions)
      .where(eq(bslWalletTransactions.id, id))
      .limit(1);
    if (!tx)
      return Response.json(
        { message: "Transaction not found" },
        { status: 404 },
      );
    if (tx.status !== "PENDING")
      return Response.json(
        { message: "Transaction already processed" },
        { status: 409 },
      );
    const [updated] = await db
      .update(bslWalletTransactions)
      .set({
        status: "REJECTED",
        description: body.reason || "Rejected by admin",
        reviewedById: user.id,
        reviewedAt: new Date(),
      } as any)
      .where(eq(bslWalletTransactions.id, id))
      .returning();
    await audit(user, "WALLET_TOPUP_REJECTED", "bsl_wallet_transactions", id, {
      reason: body.reason,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
