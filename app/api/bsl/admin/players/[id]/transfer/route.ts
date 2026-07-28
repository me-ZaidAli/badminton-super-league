import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslClubs, bslTeamMembers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
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
    if (!isAdmin(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const newClubId = Number(body.bslClubId);
    if (!Number.isFinite(newClubId))
      return Response.json({ message: "bslClubId required" }, { status: 400 });
    const [player] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.id, id))
      .limit(1);
    if (!player)
      return Response.json({ message: "Player not found" }, { status: 404 });
    const [newClub] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, newClubId))
      .limit(1);
    if (!newClub)
      return Response.json(
        { message: "Target club not found" },
        { status: 404 },
      );
    await db.delete(bslTeamMembers).where(eq(bslTeamMembers.bslPlayerId, id));
    const [updated] = await db
      .update(bslPlayers)
      .set({ bslClubId: newClubId, bslTeamId: null, confirmedByOwnerAt: null })
      .where(eq(bslPlayers.id, id))
      .returning();
    await audit(user, "ADMIN_TRANSFER_PLAYER", "bsl_players", id, {
      fromClub: player.bslClubId,
      toClub: newClubId,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
