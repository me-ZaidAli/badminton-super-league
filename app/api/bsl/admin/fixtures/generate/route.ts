import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslClubs,
  bslLeagueDays,
  bslTeams,
  bslRubbers,
} from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import { DEFAULT_CVC_TYPES } from "@/lib/server/bsl-helpers";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const body = await req.json();
    const {
      bslLeagueDayId,
      division,
      clubIds: rawClubIds,
      format,
      rubberTypes,
      settings,
    } = body;
    if (!bslLeagueDayId && !division)
      return Response.json(
        { message: "bslLeagueDayId or division required" },
        { status: 400 },
      );
    let clubsToMatch: any[];
    if (Array.isArray(rawClubIds) && rawClubIds.length) {
      clubsToMatch = await db
        .select()
        .from(bslClubs)
        .where(inArray(bslClubs.id, rawClubIds.map(Number)));
    } else {
      const q = division
        ? eq(bslClubs.division, division)
        : eq(bslClubs.status, "ACTIVE");
      clubsToMatch = await db.select().from(bslClubs).where(q);
    }
    clubsToMatch = clubsToMatch.filter((c) => c.status === "ACTIVE");
    if (clubsToMatch.length < 2)
      return Response.json(
        { message: "Need at least 2 active clubs to generate fixtures" },
        { status: 400 },
      );
    const fixtureRows: any[] = [];
    for (let i = 0; i < clubsToMatch.length; i++) {
      for (let j = i + 1; j < clubsToMatch.length; j++) {
        fixtureRows.push({
          homeClubId: clubsToMatch[i].id,
          awayClubId: clubsToMatch[j].id,
          bslLeagueDayId: bslLeagueDayId || null,
          status: "SCHEDULED",
          settings: settings || {},
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
    await audit(user, "GENERATE_FIXTURES", "bsl_fixtures", 0, {
      count: created.length,
      bslLeagueDayId,
      division,
      clubCount: clubsToMatch.length,
    });
    return Response.json({ fixtures: created, count: created.length });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
