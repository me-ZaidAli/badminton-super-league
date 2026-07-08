import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslClubs, bslLeagues } from "@/lib/server/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { genRef } from "@/lib/server/utils";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const body = await req.json();
    const { inviteCode, teamId } = body;
    if (!inviteCode)
      return Response.json(
        { message: "Invite code required" },
        { status: 400 },
      );
    const [club] = await db
      .select()
      .from(bslClubs)
      .where(
        and(eq(bslClubs.inviteCode, inviteCode), eq(bslClubs.status, "ACTIVE")),
      )
      .limit(1);
    if (!club)
      return Response.json(
        { message: "Invalid or inactive invite code" },
        { status: 404 },
      );
    const existing = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (existing.length)
      return Response.json(
        { message: "Already registered as BSL player" },
        { status: 400 },
      );
    const [league] = await db
      .select()
      .from(bslLeagues)
      .where(eq(bslLeagues.id, 1))
      .limit(1);
    const allowedGrades =
      (league?.divisionGrades as any)?.[club.division] || [];
    if (allowedGrades.length > 0)
      return Response.json(
        {
          message: `${club.division} requires a player grade in [${allowedGrades.join(", ")}]. Ask the league admin to set your grade before joining.`,
        },
        { status: 400 },
      );
    const paymentReference = genRef("BSL-PLR");
    const [created] = await db
      .insert(bslPlayers)
      .values({
        userId: user.id,
        bslClubId: club.id,
        bslTeamId: teamId || null,
        paymentReference,
      } as any)
      .returning();
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
