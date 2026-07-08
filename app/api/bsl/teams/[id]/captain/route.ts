import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslTeams, bslPlayers, bslClubs } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, isAdminish, unauthorised } from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [team] = await db
      .select()
      .from(bslTeams)
      .where(eq(bslTeams.id, id))
      .limit(1);
    if (!team)
      return Response.json({ message: "Team not found" }, { status: 404 });
    const [club] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, team.bslClubId))
      .limit(1);
    if (!club)
      return Response.json({ message: "Club not found" }, { status: 404 });
    const isOwner = club.managerUserId === user.id;
    const isClubAdmin =
      Array.isArray((club as any).adminUserIds) &&
      (club as any).adminUserIds.includes(user.id);
    if (!isOwner && !isClubAdmin && !isAdminish(user))
      return Response.json({ message: "Not allowed" }, { status: 403 });
    const body = await req.json();
    const raw = body?.playerId;
    let captainPlayerId: number | null = null;
    if (raw !== null && raw !== "" && raw !== undefined) {
      const pid = Number(raw);
      if (!Number.isFinite(pid))
        return Response.json(
          { message: "playerId must be a number or null" },
          { status: 400 },
        );
      const [player] = await db
        .select()
        .from(bslPlayers)
        .where(eq(bslPlayers.id, pid))
        .limit(1);
      if (!player)
        return Response.json(
          { message: "Captain player not found" },
          { status: 404 },
        );
      if (player.bslClubId !== team.bslClubId)
        return Response.json(
          { message: "Captain must belong to the same club" },
          { status: 400 },
        );
      if (player.status !== "ACTIVE")
        return Response.json(
          { message: "Captain must be an ACTIVE player" },
          { status: 400 },
        );
      captainPlayerId = pid;
    }
    const [updated] = await db
      .update(bslTeams)
      .set({ captainPlayerId } as any)
      .where(eq(bslTeams.id, id))
      .returning();
    await audit(user, "TEAM_SET_CAPTAIN", "bsl_teams", id, { captainPlayerId });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
