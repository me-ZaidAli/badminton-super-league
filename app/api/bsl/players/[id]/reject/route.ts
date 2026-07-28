import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

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
    const [updated] = await db
      .update(bslPlayers)
      .set({
        status: "REJECTED",
        rejectionReason: body.reason || "Rejected by admin",
      })
      .where(eq(bslPlayers.id, id))
      .returning();
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
