import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs, users } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isOwner,
  unauthorised,
  ownerOnly,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isOwner(user)) return ownerOnly();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const newManagerUserId = Number(body.managerUserId);
    if (!Number.isFinite(newManagerUserId))
      return Response.json(
        { message: "managerUserId required" },
        { status: 400 },
      );
    const [targetUser] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.id, newManagerUserId))
      .limit(1);
    if (!targetUser)
      return Response.json({ message: "User not found" }, { status: 404 });
    const [updated] = await db
      .update(bslClubs)
      .set({ managerUserId: newManagerUserId })
      .where(eq(bslClubs.id, id))
      .returning();
    if (!updated)
      return Response.json({ message: "Club not found" }, { status: 404 });
    await audit(user, "OWNER_TRANSFER_CLUB", "bsl_clubs", id, {
      newManagerUserId,
      email: targetUser.email,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
