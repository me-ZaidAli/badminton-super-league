import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslWalletTransactions, bslPlayers, users } from "@/lib/server/schema";
import { eq, desc, and, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const sp = new URL(req.url).searchParams;
    const statusFilter = sp.get("status") || "";
    const typeFilter = sp.get("type") || "";
    const all = await db
      .select()
      .from(bslWalletTransactions)
      .orderBy(desc(bslWalletTransactions.createdAt));
    const filtered = all.filter(
      (t) =>
        (!statusFilter || t.status === statusFilter) &&
        (!typeFilter || t.type === typeFilter),
    );
    const playerIds = Array.from(new Set(filtered.map((t) => t.bslPlayerId)));
    const players = playerIds.length
      ? await db
          .select({
            id: bslPlayers.id,
            userId: bslPlayers.userId,
            displayName: bslPlayers.displayName,
          })
          .from(bslPlayers)
          .where(inArray(bslPlayers.id, playerIds))
      : [];
    const userIds = Array.from(
      new Set(
        players.map((p) => p.userId).filter((x): x is number => x != null),
      ),
    );
    const userRows = userIds.length
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const uMap = new Map(userRows.map((u) => [u.id, u]));
    const pMap = new Map(
      players.map((p) => [p.id, { ...p, user: uMap.get(p.userId) || null }]),
    );
    return Response.json(
      filtered.map((t) => ({ ...t, player: pMap.get(t.bslPlayerId) || null })),
    );
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
