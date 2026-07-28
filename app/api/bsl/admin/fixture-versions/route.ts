import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslFixtureVersions } from "@/lib/server/schema";
import { eq, desc } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const sp = new URL(req.url).searchParams;
    const dayId = sp.get("bslLeagueDayId");
    const rows = dayId
      ? await db
          .select()
          .from(bslFixtureVersions)
          .where(eq(bslFixtureVersions.bslLeagueDayId, Number(dayId)))
          .orderBy(desc(bslFixtureVersions.archivedAt))
      : await db
          .select()
          .from(bslFixtureVersions)
          .orderBy(desc(bslFixtureVersions.archivedAt));
    return Response.json(rows);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
