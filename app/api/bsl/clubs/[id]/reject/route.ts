import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
import { eq, and } from "drizzle-orm";
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
    const [existing] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, id))
      .limit(1);
    if (!existing)
      return Response.json({ message: "Not found" }, { status: 404 });
    if (existing.status === "ACTIVE")
      return Response.json(
        { message: "Cannot reject an ACTIVE club" },
        { status: 409 },
      );
    if (existing.status === "REJECTED") return Response.json(existing);
    const [updated] = await db
      .update(bslClubs)
      .set({
        status: "REJECTED",
        rejectionReason: body.reason || "Rejected by admin",
      })
      .where(and(eq(bslClubs.id, id), eq(bslClubs.status, existing.status)))
      .returning();
    await audit(user, "club.rejected", "bsl_club", id, {
      from: existing.status,
      reason: body.reason || null,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
