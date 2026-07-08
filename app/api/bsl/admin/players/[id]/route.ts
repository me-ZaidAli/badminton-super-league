import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslTeamMembers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
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
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const allow = [
      "displayName",
      "bio",
      "grade",
      "categories",
      "status",
      "division",
      "bslClubId",
      "bslTeamId",
      "adminNotes",
      "walletBalance",
      "walletRank",
    ];
    const patch: any = {};
    for (const k of allow) if (k in body) patch[k] = body[k];
    if (!Object.keys(patch).length)
      return Response.json({ message: "Nothing to update" }, { status: 400 });
    const [updated] = await db
      .update(bslPlayers)
      .set(patch)
      .where(eq(bslPlayers.id, id))
      .returning();
    if (!updated)
      return Response.json({ message: "Player not found" }, { status: 404 });
    await audit(user, "ADMIN_UPDATE_PLAYER", "bsl_players", id, patch);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    await db.delete(bslTeamMembers).where(eq(bslTeamMembers.bslPlayerId, id));
    await db.delete(bslPlayers).where(eq(bslPlayers.id, id));
    await audit(user, "ADMIN_DELETE_PLAYER", "bsl_players", id, null);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
