import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslClubs, bslLeagues } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, isAdmin, unauthorised } from "@/lib/server/session";
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
    const [player] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.id, id))
      .limit(1);
    if (!player)
      return Response.json({ message: "Player not found" }, { status: 404 });
    let allowed = isAdmin(user);
    if (!allowed && player.bslClubId) {
      const [club] = await db
        .select()
        .from(bslClubs)
        .where(eq(bslClubs.id, player.bslClubId))
        .limit(1);
      if (
        club &&
        (club.managerUserId === user.id ||
          (Array.isArray((club as any).adminUserIds) &&
            (club as any).adminUserIds.includes(user.id)))
      )
        allowed = true;
    }
    if (!allowed)
      return Response.json(
        { message: "Not allowed to edit this player's grade" },
        { status: 403 },
      );
    const body = await req.json();
    const raw = body?.grade;
    let grade: string | null = null;
    if (raw !== null && raw !== "" && raw !== undefined) {
      grade = String(raw).trim().toUpperCase().slice(0, 12) || null;
      if (grade) {
        const [league] = await db
          .select()
          .from(bslLeagues)
          .where(eq(bslLeagues.id, 1))
          .limit(1);
        const known = (league?.playerGrades || []).map((g: any) =>
          String(g.code),
        );
        if (known.length && !known.includes(grade))
          return Response.json(
            { message: `Unknown grade "${grade}". Known: ${known.join(", ")}` },
            { status: 400 },
          );
      }
    }
    const [updated] = await db
      .update(bslPlayers)
      .set({ grade })
      .where(eq(bslPlayers.id, id))
      .returning();
    await audit(user, "PLAYER_SET_GRADE", "bsl_players", id, { grade });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
