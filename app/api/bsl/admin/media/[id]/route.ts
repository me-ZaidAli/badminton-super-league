import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslMedia } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit, sanitiseUrl } from "@/lib/server/utils";

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
    const patch: any = {};
    if ("caption" in body) patch.caption = body.caption;
    if ("mediaType" in body) patch.mediaType = body.mediaType;
    if ("sortOrder" in body && Number.isFinite(Number(body.sortOrder)))
      patch.sortOrder = Number(body.sortOrder);
    if (!Object.keys(patch).length)
      return Response.json({ message: "Nothing to update" }, { status: 400 });
    const [updated] = await db
      .update(bslMedia)
      .set(patch)
      .where(eq(bslMedia.id, id))
      .returning();
    if (!updated)
      return Response.json({ message: "Media not found" }, { status: 404 });
    await audit(user, "ADMIN_UPDATE_MEDIA", "bsl_media", id, patch);
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
    await db.delete(bslMedia).where(eq(bslMedia.id, id));
    await audit(user, "ADMIN_DELETE_MEDIA", "bsl_media", id, null);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
