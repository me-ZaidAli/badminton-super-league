import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [updated] = await db
      .update(bslPlayers)
      .set({
        status: "ACTIVE",
        approvedAt: new Date(),
        approvedById: user.id,
        confirmedByOwnerAt: new Date(),
      })
      .where(eq(bslPlayers.id, id))
      .returning();
    if (!updated)
      return Response.json({ message: "Player not found" }, { status: 404 });
    await audit(user, "ADMIN_ACTIVATE_PLAYER", "bsl_players", id, null);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
