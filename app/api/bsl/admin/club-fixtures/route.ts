import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslFixtures, bslClubs } from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const body = await req.json();
    const {
      homeClubId,
      awayClubId,
      bslLeagueDayId,
      category,
      startTime,
      settings,
    } = body;
    if (!homeClubId || !awayClubId)
      return Response.json(
        { message: "homeClubId and awayClubId required" },
        { status: 400 },
      );
    if (homeClubId === awayClubId)
      return Response.json(
        { message: "Home and away clubs must be different" },
        { status: 400 },
      );
    const clubs = await db
      .select()
      .from(bslClubs)
      .where(inArray(bslClubs.id, [homeClubId, awayClubId]));
    if (clubs.length < 2)
      return Response.json(
        { message: "One or more clubs not found" },
        { status: 404 },
      );
    const [created] = await db
      .insert(bslFixtures)
      .values({
        homeClubId,
        awayClubId,
        bslLeagueDayId: bslLeagueDayId || null,
        category: category || null,
        startTime: startTime || null,
        status: "SCHEDULED",
        settings: settings || {},
      } as any)
      .returning();
    await audit(user, "CREATE_CLUB_FIXTURE", "bsl_fixtures", created.id, {
      homeClubId,
      awayClubId,
      bslLeagueDayId,
    });
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
