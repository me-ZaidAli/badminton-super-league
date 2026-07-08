import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslRubbers, bslFixtures } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import { assertFixtureStructural } from "@/lib/server/bsl-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const [fixture] = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.id, id))
      .limit(1);
    if (!fixture)
      return Response.json({ message: "Fixture not found" }, { status: 404 });
    const errMsg = assertFixtureStructural(fixture);
    if (errMsg) return Response.json({ message: errMsg }, { status: 400 });
    const existing = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.bslFixtureId, id));
    const rubberNumber = existing.length + 1;
    const { category, homeTeamId, awayTeamId, label } = body;
    const [created] = await db
      .insert(bslRubbers)
      .values({
        bslFixtureId: id,
        rubberNumber,
        category: category || null,
        homeTeamId: homeTeamId || null,
        awayTeamId: awayTeamId || null,
        label: label || null,
        status: "PENDING",
      } as any)
      .returning();
    await audit(user, "ADD_RUBBER", "bsl_rubbers", created.id, {
      fixtureId: id,
      rubberNumber,
    });
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
