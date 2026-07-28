import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslClubs, users } from "@/lib/server/schema";
import { eq, and, desc, inArray, ilike, or } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { genRef } from "@/lib/server/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const sp = new URL(req.url).searchParams;
    const search = sp.get("search") || "";
    const statusFilter = sp.get("status") || "";
    const clubFilter = sp.get("clubId") ? Number(sp.get("clubId")) : null;
    const all = await db
      .select()
      .from(bslPlayers)
      .orderBy(desc(bslPlayers.createdAt));
    const filtered = all.filter(
      (p) =>
        (!statusFilter || p.status === statusFilter) &&
        (!clubFilter || p.bslClubId === clubFilter),
    );
    const userIds = Array.from(
      new Set(
        filtered.map((p) => p.userId).filter((x): x is number => x != null),
      ),
    );
    const userRows = userIds.length
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
            phone: users.phone,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const uMap = new Map(userRows.map((u) => [u.id, u]));
    let result = filtered.map((p) => ({
      ...p,
      user: uMap.get(p.userId) || null,
    }));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (p) =>
          (p.user?.fullName || "").toLowerCase().includes(q) ||
          (p.user?.email || "").toLowerCase().includes(q) ||
          (p.displayName || "").toLowerCase().includes(q),
      );
    }
    return Response.json(result);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const body = await req.json();
    const {
      userId,
      bslClubId,
      displayName,
      grade,
      categories,
      status,
      division,
    } = body;
    if (!userId)
      return Response.json({ message: "userId required" }, { status: 400 });
    const existing = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, userId))
      .limit(1);
    if (existing.length)
      return Response.json(
        { message: "Player already registered" },
        { status: 409 },
      );
    const paymentReference = genRef("BSL-PLR");
    const [created] = await db
      .insert(bslPlayers)
      .values({
        userId,
        bslClubId: bslClubId || null,
        displayName: displayName || null,
        grade: grade || null,
        categories: categories || [],
        status: status || "PENDING_PAYMENT",
        division: division || null,
        paymentReference,
      } as any)
      .returning();
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
