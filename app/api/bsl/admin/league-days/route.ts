import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslLeagueDays } from "@/lib/server/schema";
import { desc } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const rows = await db
      .select()
      .from(bslLeagueDays)
      .orderBy(desc(bslLeagueDays.date));
    return Response.json(rows);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const body = await req.json();
    const { date, division, venue, startTime, endTime } = body;
    if (!date || !division)
      return Response.json(
        { message: "date and division required" },
        { status: 400 },
      );
    const [created] = await db
      .insert(bslLeagueDays)
      .values({
        date,
        division,
        venue: venue || null,
        startTime: startTime || null,
        endTime: endTime || null,
      } as any)
      .returning();
    await audit(user, "CREATE_LEAGUE_DAY", "bsl_league_days", created.id, {
      date,
      division,
    });
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
