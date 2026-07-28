import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslFixtures } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

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
    const [fixture] = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.id, id))
      .limit(1);
    if (!fixture)
      return Response.json({ message: "Fixture not found" }, { status: 404 });
    if (!["SCHEDULED", "POSTPONED"].includes(fixture.status))
      return Response.json(
        { message: "Fixture must be SCHEDULED or POSTPONED to go live" },
        { status: 400 },
      );
    const [updated] = await db
      .update(bslFixtures)
      .set({ status: "IN_PROGRESS", startTime: new Date() } as any)
      .where(eq(bslFixtures.id, id))
      .returning();
    await audit(user, "FIXTURE_GO_LIVE", "bsl_fixtures", id, null);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
