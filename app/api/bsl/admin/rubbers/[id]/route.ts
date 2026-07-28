import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslRubbers, bslFixtures } from "@/lib/server/schema";
import { eq, and, gt } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import { assertFixtureStructural } from "@/lib/server/bsl-helpers";
import { sql } from "drizzle-orm";

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
    const [rubber] = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.id, id))
      .limit(1);
    if (!rubber)
      return Response.json({ message: "Rubber not found" }, { status: 404 });
    const [fixture] = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.id, rubber.bslFixtureId))
      .limit(1);
    if (!fixture)
      return Response.json({ message: "Fixture not found" }, { status: 404 });
    const errMsg = assertFixtureStructural(fixture);
    if (errMsg) return Response.json({ message: errMsg }, { status: 400 });
    const deletedNumber = rubber.rubberNumber;
    await db.delete(bslRubbers).where(eq(bslRubbers.id, id));
    await db
      .update(bslRubbers)
      .set({ rubberNumber: sql`rubber_number - 1` })
      .where(
        and(
          eq(bslRubbers.bslFixtureId, rubber.bslFixtureId),
          gt(bslRubbers.rubberNumber, deletedNumber),
        ),
      );
    await audit(user, "DELETE_RUBBER", "bsl_rubbers", id, {
      fixtureId: rubber.bslFixtureId,
      deletedNumber,
    });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
