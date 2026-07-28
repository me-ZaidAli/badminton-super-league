import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslTeams, bslTeamMembers, bslPlayers } from "@/lib/server/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser, isAdmin, unauthorised } from "@/lib/server/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const { playerId } = body;
    const [team] = await db
      .select()
      .from(bslTeams)
      .where(eq(bslTeams.id, id))
      .limit(1);
    if (!team)
      return Response.json({ message: "Team not found" }, { status: 404 });
    const [player] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.id, playerId))
      .limit(1);
    if (!player)
      return Response.json({ message: "Player not found" }, { status: 404 });
    if (player.bslClubId !== team.bslClubId)
      return Response.json(
        { message: "Player not in same club" },
        { status: 400 },
      );
    const existing = await db
      .select()
      .from(bslTeamMembers)
      .where(
        and(
          eq(bslTeamMembers.bslTeamId, id),
          eq(bslTeamMembers.bslPlayerId, playerId),
        ),
      )
      .limit(1);
    if (existing.length)
      return Response.json({ message: "Already a member" }, { status: 409 });
    const [created] = await db
      .insert(bslTeamMembers)
      .values({ bslTeamId: id, bslPlayerId: playerId } as any)
      .returning();
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
