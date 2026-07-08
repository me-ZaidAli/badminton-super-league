import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";
import { audit } from "@/lib/server/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const { club, reason } = await loadClubForManager(user, id);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    if (club.withdrawnAt)
      return Response.json(
        { message: "Club already withdrawn" },
        { status: 400 },
      );
    const body = await req.json();
    const [updated] = await db
      .update(bslClubs)
      .set({
        withdrawnAt: new Date(),
        isSuspended: true,
        adminNotes: [
          club.adminNotes,
          `Withdrawn by manager ${new Date().toISOString()}: ${body.reason || "(no reason)"}`,
        ]
          .filter(Boolean)
          .join("\n"),
      })
      .where(eq(bslClubs.id, id))
      .returning();
    await audit(user, "MANAGER_WITHDRAW_CLUB", "bsl_clubs", id, {
      reason: body.reason,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
