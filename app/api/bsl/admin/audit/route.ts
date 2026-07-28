import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslAuditLog, users } from "@/lib/server/schema";
import { desc, ilike, and, eq, inArray } from "drizzle-orm";
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
    const entity = sp.get("entity") || "";
    const action = sp.get("action") || "";
    const limitRaw = sp.get("limit");
    const limit = limitRaw
      ? Math.min(500, Math.max(1, Number(limitRaw) || 100))
      : 100;
    let rows = await db
      .select()
      .from(bslAuditLog)
      .orderBy(desc(bslAuditLog.createdAt))
      .limit(limit);
    if (entity) rows = rows.filter((r) => r.entity === entity);
    if (action) rows = rows.filter((r) => r.action === action);
    const userIds = Array.from(
      new Set(
        rows.map((r) => r.actorUserId).filter((x): x is number => x != null),
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
    return Response.json(
      rows.map((r) => ({ ...r, user: uMap.get(r.actorUserId ?? -1) || null })),
    );
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
