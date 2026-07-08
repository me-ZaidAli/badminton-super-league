import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslWalletTransactions } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (!me) return Response.json({ balance: 0, transactions: [] });
    const txRows = await db
      .select()
      .from(bslWalletTransactions)
      .where(eq(bslWalletTransactions.bslPlayerId, me.id));
    return Response.json({
      balance: me.walletBalance || 0,
      transactions: txRows,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
