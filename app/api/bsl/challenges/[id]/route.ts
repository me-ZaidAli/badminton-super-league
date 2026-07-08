import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslChallenges, bslPlayers } from "@/lib/server/schema";
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
    const body = await req.json();
    const { action, message } = body;
    if (!["ACCEPT", "DECLINE", "CANCEL"].includes(action))
      return Response.json(
        { message: "action must be ACCEPT, DECLINE, or CANCEL" },
        { status: 400 },
      );
    const [challenge] = await db
      .select()
      .from(bslChallenges)
      .where(eq(bslChallenges.id, id))
      .limit(1);
    if (!challenge)
      return Response.json({ message: "Challenge not found" }, { status: 404 });
    if (challenge.status !== "PENDING")
      return Response.json(
        { message: "Challenge already resolved" },
        { status: 409 },
      );
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    const myClubId = me?.bslClubId;
    if (action === "CANCEL") {
      if (challenge.challengerClubId !== myClubId && !isAdminish(user))
        return Response.json(
          { message: "Only the challenger can cancel" },
          { status: 403 },
        );
    } else {
      if (challenge.opponentClubId !== myClubId && !isAdminish(user))
        return Response.json(
          { message: "Only the challenged club can accept or decline" },
          { status: 403 },
        );
    }
    const statusMap: Record<string, string> = {
      ACCEPT: "ACCEPTED",
      DECLINE: "DECLINED",
      CANCEL: "CANCELLED",
    };
    const [updated] = await db
      .update(bslChallenges)
      .set({
        status: statusMap[action],
        responseMessage: message ? String(message).slice(0, 500) : null,
        respondedAt: new Date(),
      } as any)
      .where(eq(bslChallenges.id, id))
      .returning();
    await audit(user, `BSL_CHALLENGE_${action}`, "bsl_challenges", id, {
      action,
      myClubId,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
