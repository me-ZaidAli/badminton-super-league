import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslRubbers,
  bslTeams,
  bslClubs,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import {
  computeFixtureScore,
  assertFixtureMutable,
  recomputeStandings,
} from "@/lib/server/bsl-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [fixture] = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.id, id))
      .limit(1);
    if (!fixture)
      return Response.json({ message: "Not found" }, { status: 404 });
    const rubbers = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.bslFixtureId, id))
      .orderBy(bslRubbers.rubberNumber);
    const teamIds = [fixture.homeTeamId, fixture.awayTeamId].filter(
      (x): x is number => x != null,
    );
    const teams = teamIds.length
      ? await db.select().from(bslTeams).where(inArray(bslTeams.id, teamIds))
      : [];
    const clubIds = [fixture.homeClubId, fixture.awayClubId].filter(
      (x): x is number => x != null,
    );
    const clubRows = clubIds.length
      ? await db.select().from(bslClubs).where(inArray(bslClubs.id, clubIds))
      : [];
    const cMap = new Map(clubRows.map((c) => [c.id, c]));
    const homeClub =
      fixture.homeClubId != null ? cMap.get(fixture.homeClubId) || null : null;
    const awayClub =
      fixture.awayClubId != null ? cMap.get(fixture.awayClubId) || null : null;
    return Response.json({
      ...fixture,
      rubbers,
      teams,
      homeClub,
      awayClub,
      ...computeFixtureScore(rubbers),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

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
    const {
      court,
      status,
      startTime,
      homeClubId,
      awayClubId,
      bslLeagueDayId,
      division,
    } = await req.json();
    const structural =
      homeClubId !== undefined ||
      awayClubId !== undefined ||
      bslLeagueDayId !== undefined;
    const hasNonStatus =
      court !== undefined || startTime !== undefined || structural;
    const action = hasNonStatus ? "edit" : status ? "status" : "edit";
    const block = await assertFixtureMutable(id, new Set(["status"]), action);
    if (block) return Response.json({ message: block }, { status: 409 });
    const patch: any = {};
    if (court !== undefined) patch.court = court;
    if (status) patch.status = status;
    if (startTime) patch.startTime = new Date(startTime);
    if (homeClubId !== undefined)
      patch.homeClubId = homeClubId == null ? null : Number(homeClubId);
    if (awayClubId !== undefined)
      patch.awayClubId = awayClubId == null ? null : Number(awayClubId);
    if (bslLeagueDayId !== undefined)
      patch.bslLeagueDayId =
        bslLeagueDayId == null ? null : Number(bslLeagueDayId);
    if (division !== undefined)
      patch.division =
        division == null ? null : String(division).trim().slice(0, 56) || null;
    if (
      patch.homeClubId != null &&
      patch.awayClubId != null &&
      patch.homeClubId === patch.awayClubId
    )
      return Response.json(
        { message: "Home and away clubs must differ" },
        { status: 400 },
      );
    const [updated] = await db
      .update(bslFixtures)
      .set(patch)
      .where(eq(bslFixtures.id, id))
      .returning();
    if (status === "FINISHED") await recomputeStandings();
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
