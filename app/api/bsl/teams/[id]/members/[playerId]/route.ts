import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslTeamMembers } from "@/lib/server/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr, playerId: playerIdStr } = await params;
    const id = Number(idStr);
    const playerId = Number(playerIdStr);
    await db
      .delete(bslTeamMembers)
      .where(
        and(
          eq(bslTeamMembers.bslTeamId, id),
          eq(bslTeamMembers.bslPlayerId, playerId),
        ),
      );
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
