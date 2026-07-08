import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
import { eq, and } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit, genInvite, sendRulePush } from "@/lib/server/utils";

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
    const [existing] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, id))
      .limit(1);
    if (!existing)
      return Response.json({ message: "Not found" }, { status: 404 });
    if (existing.status === "ACTIVE")
      return Response.json(
        { message: "Club already active", club: existing },
        { status: 409 },
      );
    if (existing.status === "REJECTED")
      return Response.json(
        { message: "Club is REJECTED — cannot approve" },
        { status: 409 },
      );
    const inviteCode = existing.inviteCode || genInvite();
    const [updated] = await db
      .update(bslClubs)
      .set({
        status: "ACTIVE",
        inviteCode,
        approvedAt: new Date(),
        approvedById: user.id,
      })
      .where(and(eq(bslClubs.id, id), eq(bslClubs.status, existing.status)))
      .returning();
    if (!updated)
      return Response.json(
        { message: "Status changed during approval, please retry" },
        { status: 409 },
      );
    await audit(user, "club.approved", "bsl_club", id, {
      from: existing.status,
      to: "ACTIVE",
      inviteCode,
    });
    if (updated.managerUserId)
      sendRulePush(
        "bslClubApproved",
        [updated.managerUserId],
        { inviteCode: updated.inviteCode || "" },
        {
          url: "/bsl",
          dedupe: { refType: "bsl-club-approved", refId: updated.id },
        },
      ).catch(() => {});
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
