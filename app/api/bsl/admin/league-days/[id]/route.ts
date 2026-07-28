import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslLeagueDays } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const allow = [
      "date",
      "division",
      "venue",
      "startTime",
      "endTime",
      "notes",
    ];
    const patch: any = {};
    for (const k of allow) if (k in body) patch[k] = body[k];
    if (!Object.keys(patch).length)
      return Response.json({ message: "Nothing to update" }, { status: 400 });
    const [updated] = await db
      .update(bslLeagueDays)
      .set(patch)
      .where(eq(bslLeagueDays.id, id))
      .returning();
    await audit(user, "UPDATE_LEAGUE_DAY", "bsl_league_days", id, patch);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    await db.delete(bslLeagueDays).where(eq(bslLeagueDays.id, id));
    await audit(user, "DELETE_LEAGUE_DAY", "bsl_league_days", id, null);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
