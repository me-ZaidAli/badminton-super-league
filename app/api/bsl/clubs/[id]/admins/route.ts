import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs, bslPlayers } from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
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
    const body = await req.json();
    const [club] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, id))
      .limit(1);
    if (!club)
      return Response.json({ message: "Club not found" }, { status: 404 });
    if (club.managerUserId !== user.id && !isAdmin(user))
      return Response.json(
        { message: "Only the owner or super admin can change club admins" },
        { status: 403 },
      );
    const raw = Array.isArray(body.adminUserIds) ? body.adminUserIds : [];
    const candidates = raw
      .map((x: any) => Number(x))
      .filter(
        (x: number) => Number.isFinite(x) && x > 0 && x !== club.managerUserId,
      );
    let valid: number[] = [];
    if (candidates.length) {
      const activeMembers = await db
        .select({ userId: bslPlayers.userId })
        .from(bslPlayers)
        .where(
          and(eq(bslPlayers.bslClubId, id), eq(bslPlayers.status, "ACTIVE")),
        );
      const activeMemberIds = new Set(activeMembers.map((p) => p.userId));
      valid = candidates.filter((uid) => activeMemberIds.has(uid));
    }
    const [updated] = await db
      .update(bslClubs)
      .set({ adminUserIds: valid } as any)
      .where(eq(bslClubs.id, id))
      .returning();
    await audit(user, "CLUB_SET_ADMINS", "bsl_clubs", id, {
      adminUserIds: valid,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
