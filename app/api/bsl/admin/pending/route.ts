import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslClubs, users } from "@/lib/server/schema";
import { eq, or, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const pendingPlayers = await db
      .select()
      .from(bslPlayers)
      .where(
        or(
          eq(bslPlayers.status, "PENDING_PAYMENT"),
          eq(bslPlayers.status, "PENDING_VERIFICATION"),
        ),
      );
    const pendingClubs = await db
      .select()
      .from(bslClubs)
      .where(
        or(
          eq(bslClubs.status, "PENDING_PAYMENT"),
          eq(bslClubs.status, "PENDING_VERIFICATION"),
        ),
      );
    const userIds = Array.from(
      new Set(
        pendingPlayers
          .map((p) => p.userId)
          .filter((x): x is number => x != null),
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
    return Response.json({
      players: pendingPlayers.map((p) => ({
        ...p,
        user: uMap.get(p.userId) || null,
      })),
      clubs: pendingClubs,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
