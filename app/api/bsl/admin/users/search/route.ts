import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { ilike, or, eq } from "drizzle-orm";
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
    const q = sp.get("q") || "";
    if (q.length < 2) return Response.json([]);
    const all = await db
      .select({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users);
    const lq = q.toLowerCase();
    const filtered = all
      .filter(
        (u) =>
          (u.fullName || "").toLowerCase().includes(lq) ||
          (u.email || "").toLowerCase().includes(lq),
      )
      .slice(0, 20);
    return Response.json(filtered);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
