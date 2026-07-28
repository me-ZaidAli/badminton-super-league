import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslTeams } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, isAdmin, unauthorised } from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user))
      return Response.json({ message: "Admin only" }, { status: 403 });
    const { id: idStr } = await params;
    const id = Number(idStr);
    await db.delete(bslTeams).where(eq(bslTeams.id, id));
    await audit(user, "DELETE_TEAM", "bsl_teams", id, null);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
