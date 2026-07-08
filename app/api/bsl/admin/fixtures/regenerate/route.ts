import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslRubbers,
  bslFixtureVersions,
  bslClubs,
} from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const body = await req.json();
    const { bslLeagueDayId } = body;
    if (!bslLeagueDayId)
      return Response.json(
        { message: "bslLeagueDayId required" },
        { status: 400 },
      );
    const existing = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.bslLeagueDayId, bslLeagueDayId));
    if (!existing.length)
      return Response.json(
        { message: "No existing fixtures to regenerate" },
        { status: 400 },
      );
    const fixtureIds = existing.map((f) => f.id);
    const rubbers = fixtureIds.length
      ? await db
          .select()
          .from(bslRubbers)
          .where(inArray(bslRubbers.bslFixtureId, fixtureIds))
      : [];
    if ((db as any).insert && bslFixtureVersions) {
      const versionRows = existing.map((f) => ({
        bslLeagueDayId,
        fixtureData: f as any,
        createdById: user.id,
        snapshotAt: new Date(),
      }));
      if (versionRows.length)
        await db.insert(bslFixtureVersions).values(versionRows as any);
    }
    if (fixtureIds.length)
      await db
        .delete(bslRubbers)
        .where(inArray(bslRubbers.bslFixtureId, fixtureIds));
    await db
      .delete(bslFixtures)
      .where(eq(bslFixtures.bslLeagueDayId, bslLeagueDayId));
    const clubIds = Array.from(
      new Set(
        existing.flatMap((f) =>
          [f.homeClubId, f.awayClubId].filter((x): x is number => x != null),
        ),
      ),
    );
    const clubs = clubIds.length
      ? await db.select().from(bslClubs).where(inArray(bslClubs.id, clubIds))
      : [];
    const activeClubs = clubs.filter((c) => c.status === "ACTIVE");
    const fixtureRows: any[] = [];
    for (let i = 0; i < activeClubs.length; i++) {
      for (let j = i + 1; j < activeClubs.length; j++) {
        fixtureRows.push({
          homeClubId: activeClubs[i].id,
          awayClubId: activeClubs[j].id,
          bslLeagueDayId,
          status: "SCHEDULED",
          settings: {},
          category: null,
        });
      }
    }
    const created = fixtureRows.length
      ? await db
          .insert(bslFixtures)
          .values(fixtureRows as any)
          .returning()
      : [];
    await audit(user, "REGENERATE_FIXTURES", "bsl_fixtures", 0, {
      bslLeagueDayId,
      archived: existing.length,
      created: created.length,
    });
    return Response.json({
      archived: existing.length,
      fixtures: created,
      count: created.length,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
