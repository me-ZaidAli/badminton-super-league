import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs, users } from "@/lib/server/schema";
import { eq, inArray, ilike, desc } from "drizzle-orm";
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
    let q: any = db.select().from(bslClubs).orderBy(desc(bslClubs.createdAt));
    const rows = await db
      .select()
      .from(bslClubs)
      .orderBy(desc(bslClubs.createdAt));
    const filtered = rows.filter(
      (c) =>
        (!search || c.name.toLowerCase().includes(search.toLowerCase())) &&
        (!statusFilter || c.status === statusFilter),
    );
    const userIds = Array.from(
      new Set(
        filtered
          .map((c) => c.managerUserId)
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
    return Response.json(
      filtered.map((c) => ({
        ...c,
        manager: uMap.get(c.managerUserId) || null,
      })),
    );
  } catch (err: any) {
    console.error("[admin/clubs GET]", err);
    return Response.json({ message: "Failed to load clubs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const body = await req.json();
    const {
      name,
      division,
      additionalDivisions,
      managerUserId,
      logoUrl,
      categories,
      categoryPairs,
      status,
    } = body;
    if (!name || !division)
      return Response.json(
        { message: "name and division required" },
        { status: 400 },
      );
    const paymentReference = genRef("BSL-CLUB");
    const [created] = await db
      .insert(bslClubs)
      .values({
        name,
        division,
        managerUserId: managerUserId || user.id,
        logoUrl: logoUrl || null,
        categories: categories || [],
        categoryPairs: categoryPairs || {},
        paymentReference,
        status: status === "PENDING_PAYMENT" ? "PENDING_PAYMENT" : "ACTIVE",
        additionalDivisions: Array.isArray(additionalDivisions)
          ? additionalDivisions.filter((d): d is string => typeof d === "string")
          : [],
      } as any)
      .returning();
    return Response.json(created);
  } catch (err: any) {
    console.error("[admin/clubs POST]", err);
    return Response.json({ message: "Failed to create club" }, { status: 500 });
  }
}
