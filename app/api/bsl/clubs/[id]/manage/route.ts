import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";
import { audit, sanitiseUrl } from "@/lib/server/utils";

export async function PATCH(
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
    const body = await req.json();
    const allow = ["name", "logoUrl", "division", "adminNotes"];
    const patch: any = {};
    for (const k of allow) if (k in body) patch[k] = body[k];
    if ("logoUrl" in patch) patch.logoUrl = sanitiseUrl(patch.logoUrl, "image");
    if (!Object.keys(patch).length)
      return Response.json({ message: "Nothing to update" }, { status: 400 });
    const [updated] = await db
      .update(bslClubs)
      .set(patch)
      .where(eq(bslClubs.id, id))
      .returning();
    await audit(user, "MANAGER_UPDATE_CLUB", "bsl_clubs", id, patch);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
