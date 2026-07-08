import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslRubbers,
  bslFixtures,
  bslTeams,
  bslTeamMembers,
  bslPlayers,
} from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import { assertFixtureMutable } from "@/lib/server/bsl-helpers";

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
    const body = await req.json();
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
    const errMsg = await assertFixtureMutable(
      fixture.id,
      new Set(["ASSIGN"]),
      "ASSIGN",
    );
    if (errMsg) return Response.json({ message: errMsg }, { status: 400 });
    const { homeTeamId, awayTeamId } = body;
    const patch: any = {};
    if (homeTeamId !== undefined) patch.homeTeamId = homeTeamId;
    if (awayTeamId !== undefined) patch.awayTeamId = awayTeamId;
    if (!Object.keys(patch).length)
      return Response.json(
        { message: "Provide homeTeamId or awayTeamId" },
        { status: 400 },
      );
    const [updated] = await db
      .update(bslRubbers)
      .set(patch)
      .where(eq(bslRubbers.id, id))
      .returning();
    await audit(user, "RUBBER_ASSIGN_TEAMS", "bsl_rubbers", id, patch);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
