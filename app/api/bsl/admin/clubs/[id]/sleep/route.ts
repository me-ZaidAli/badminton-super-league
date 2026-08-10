import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
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
    const [updated] = await db
      .update(bslClubs)
      .set({ isSuspended: body.isSuspended ?? true } as any)
      .where(eq(bslClubs.id, id))
      .returning();
    if (!updated)
      return Response.json({ message: "Club not found" }, { status: 404 });
    await audit(user, "ADMIN_SLEEP_CLUB", "bsl_clubs", id, {
      isSuspended: body.isSuspended,
    });
    return Response.json(updated);
  } catch (err: any) {
    console.error("[admin/clubs/[id]/sleep PATCH]", err);
    return Response.json({ message: "Failed to update club" }, { status: 500 });
  }
}
