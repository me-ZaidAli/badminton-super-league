import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslChallenges, bslClubs, bslPlayers } from "@/lib/server/schema";
import { eq, or, and, desc } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (!me || !me.bslClubId) return Response.json([]);
    const rows = await db
      .select()
      .from(bslChallenges)
      .where(
        or(
          eq(bslChallenges.challengerClubId, me.bslClubId!),
          eq(bslChallenges.opponentClubId, me.bslClubId!),
        ),
      )
      .orderBy(desc(bslChallenges.createdAt));
    return Response.json(rows);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (!me || !me.bslClubId)
      return Response.json(
        { message: "No active BSL club membership" },
        { status: 400 },
      );
    const body = await req.json();
    const { challengedClubId, leagueDayId, message } = body;
    if (!challengedClubId)
      return Response.json(
        { message: "challengedClubId required" },
        { status: 400 },
      );
    if (challengedClubId === me.bslClubId)
      return Response.json(
        { message: "Cannot challenge your own club" },
        { status: 400 },
      );
    const [challenger] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, me.bslClubId))
      .limit(1);
    const [challenged] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, challengedClubId))
      .limit(1);
    if (!challenged || challenged.status !== "ACTIVE")
      return Response.json(
        { message: "Challenged club not found or not active" },
        { status: 404 },
      );
    const existing = await db
      .select()
      .from(bslChallenges)
      .where(
        and(
          eq(bslChallenges.challengerClubId, me.bslClubId!),
          eq(bslChallenges.opponentClubId, challengedClubId),
          eq(bslChallenges.status, "PENDING"),
        ),
      )
      .limit(1);
    if (existing.length)
      return Response.json(
        { message: "Already have a pending challenge against this club" },
        { status: 409 },
      );
    const [row] = await db
      .insert(bslChallenges)
      .values({
        challengerClubId: me.bslClubId!,
        opponentClubId: challengedClubId,
        createdById: user.id,
        leagueDayId: leagueDayId || 1,
        message: message ? String(message).slice(0, 500) : null,
        status: "PENDING",
      } as any)
      .returning();
    await audit(user, "BSL_CHALLENGE_SENT", "bsl_challenges", row.id, {
      challengerClubId: me.bslClubId,
      opponentClubId: challengedClubId,
    });
    return Response.json(row);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
