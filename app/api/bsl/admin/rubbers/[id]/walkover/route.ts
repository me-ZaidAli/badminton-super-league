import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslRubbers, bslFixtures } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import {
  assertFixtureMutable,
  recomputeStandings,
} from "@/lib/server/bsl-helpers";

export async function POST(
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
    const { side } = body;
    if (!["home", "away"].includes(side))
      return Response.json(
        { message: "side must be 'home' or 'away'" },
        { status: 400 },
      );
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
      new Set(["WALKOVER"]),
      "WALKOVER",
    );
    if (errMsg) return Response.json({ message: errMsg }, { status: 400 });
    const settings = (fixture.rulesSnapshot as any) || {};
    const setsToWin = Number(settings.setsToWin) || 2;
    const homeScore = side === "home" ? setsToWin : 0;
    const awayScore = side === "away" ? setsToWin : 0;
    const [updated] = await db
      .update(bslRubbers)
      .set({
        homeScore,
        awayScore,
        status: "FINISHED",
        walkoverWinner: side,
      } as any)
      .where(eq(bslRubbers.id, id))
      .returning();
    await audit(user, "ADMIN_RUBBER_WALKOVER", "bsl_rubbers", id, {
      side,
      homeScore,
      awayScore,
    });
    const allRubbers = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.bslFixtureId, fixture.id));
    const allDone = allRubbers.every((r) => r.status === "FINISHED");
    if (allDone) {
      const totalHome = allRubbers.filter(
        (r) => (r.homeScore || 0) > (r.awayScore || 0),
      ).length;
      const totalAway = allRubbers.filter(
        (r) => (r.awayScore || 0) > (r.homeScore || 0),
      ).length;
      await db
        .update(bslFixtures)
        .set({
          homeRubbers: totalHome,
          awayRubbers: totalAway,
          status: "FINISHED",
        })
        .where(eq(bslFixtures.id, fixture.id));
      await recomputeStandings(fixture.bslLeagueDayId || undefined);
    }
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
