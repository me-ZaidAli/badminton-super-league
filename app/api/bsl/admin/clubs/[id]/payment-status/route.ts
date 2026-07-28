import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
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
    const ALLOWED = ["PAID", "UNPAID", "PARTIAL", "WAIVED"];
    const paymentStatus = String(body.paymentStatus || "").toUpperCase();
    if (!ALLOWED.includes(paymentStatus))
      return Response.json(
        { message: `paymentStatus must be one of ${ALLOWED.join(", ")}` },
        { status: 400 },
      );
    const patch: any = { paymentStatus };
    if (body.adminNotes !== undefined) patch.adminNotes = body.adminNotes;
    if (body.paymentDate !== undefined) patch.paymentDate = body.paymentDate;
    const [updated] = await db
      .update(bslClubs)
      .set(patch)
      .where(eq(bslClubs.id, id))
      .returning();
    if (!updated)
      return Response.json({ message: "Club not found" }, { status: 404 });
    await audit(user, "ADMIN_UPDATE_CLUB_PAYMENT_STATUS", "bsl_clubs", id, {
      paymentStatus,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
