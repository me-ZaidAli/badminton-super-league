import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslFixtures, bslRubbers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    await db.delete(bslRubbers).where(eq(bslRubbers.bslFixtureId, id));
    await db.delete(bslFixtures).where(eq(bslFixtures.id, id));
    await audit(user, "DELETE_FIXTURE", "bsl_fixtures", id, null);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
