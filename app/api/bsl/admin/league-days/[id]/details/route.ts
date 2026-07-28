import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslLeagueDays,
  bslFixtures,
  bslClubs,
  bslRubbers,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [day] = await db
      .select()
      .from(bslLeagueDays)
      .where(eq(bslLeagueDays.id, id))
      .limit(1);
    if (!day)
      return Response.json(
        { message: "League day not found" },
        { status: 404 },
      );
    const fixtures = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.bslLeagueDayId, id));
    const clubIds = Array.from(
      new Set(
        fixtures.flatMap((f) =>
          [f.homeClubId, f.awayClubId].filter((x): x is number => x != null),
        ),
      ),
    );
    const clubs = clubIds.length
      ? await db
          .select({ id: bslClubs.id, name: bslClubs.name })
          .from(bslClubs)
          .where(inArray(bslClubs.id, clubIds))
      : [];
    const clubMap = new Map(clubs.map((c) => [c.id, c.name]));
    const fixtureIds = fixtures.map((f) => f.id);
    const rubbers = fixtureIds.length
      ? await db
          .select()
          .from(bslRubbers)
          .where(inArray(bslRubbers.bslFixtureId, fixtureIds))
      : [];
    const rubbersByFixture = new Map<number, typeof rubbers>();
    for (const r of rubbers) {
      const arr = rubbersByFixture.get(r.bslFixtureId) || [];
      arr.push(r);
      rubbersByFixture.set(r.bslFixtureId, arr);
    }
    const hydrated = fixtures.map((f) => ({
      ...f,
      homeClubName:
        f.homeClubId != null ? clubMap.get(f.homeClubId) || null : null,
      awayClubName:
        f.awayClubId != null ? clubMap.get(f.awayClubId) || null : null,
      rubbers: rubbersByFixture.get(f.id) || [],
    }));
    return Response.json({ day, fixtures: hydrated });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
