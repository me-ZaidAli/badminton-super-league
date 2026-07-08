import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers } from "@/lib/server/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";
import { audit, sendRulePush } from "@/lib/server/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr, playerId: playerIdStr } = await params;
    const id = Number(idStr);
    const playerId = Number(playerIdStr);
    const { club, reason } = await loadClubForManager(user, id);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    const [player] = await db
      .select()
      .from(bslPlayers)
      .where(and(eq(bslPlayers.id, playerId), eq(bslPlayers.bslClubId, id)))
      .limit(1);
    if (!player)
      return Response.json(
        { message: "Player not in your club" },
        { status: 404 },
      );
    const [updated] = await db
      .update(bslPlayers)
      .set({ confirmedByOwnerAt: new Date() })
      .where(eq(bslPlayers.id, playerId))
      .returning();
    await audit(user, "MANAGER_CONFIRM_PLAYER", "bsl_players", playerId, null);
    sendRulePush(
      "bslClubApproved",
      [player.userId],
      { clubName: club.name },
      {
        url: "/bsl",
        dedupe: { refType: "bsl-player-confirmed", refId: playerId },
      },
    ).catch(() => {});
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
