import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit, sanitiseUrl } from "@/lib/server/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const allow = [
      "name",
      "division",
      "logoUrl",
      "adminNotes",
      "status",
      "paymentStatus",
      "paymentAmountPence",
      "paymentDate",
      "payerAccountName",
      "inviteCode",
      "contactUserId",
      "additionalDivisions",
      "categoryPairs",
      "categories",
    ];
    const patch: any = {};
    for (const k of allow) if (k in body) patch[k] = body[k];
    if ("logoUrl" in patch) patch.logoUrl = sanitiseUrl(patch.logoUrl, "image");
    if (!Object.keys(patch).length)
      return Response.json({ message: "Nothing to update" }, { status: 400 });
    const [updated] = await db
      .update(bslClubs)
      .set(patch)
      .where(eq(bslClubs.id, id))
      .returning();
    if (!updated)
      return Response.json({ message: "Club not found" }, { status: 404 });
    await audit(user, "ADMIN_UPDATE_CLUB", "bsl_clubs", id, patch);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
