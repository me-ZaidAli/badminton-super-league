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
import { recomputeStandings } from "@/lib/server/bsl-helpers";

export async function PATCH(
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
    const { status } = body;
    const ALLOWED = [
      "SCHEDULED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
      "POSTPONED",
    ];
    if (!ALLOWED.includes(status))
      return Response.json(
        { message: `status must be one of ${ALLOWED.join(", ")}` },
        { status: 400 },
      );
    const [updated] = await db
      .update(bslFixtures)
      .set({ status })
      .where(eq(bslFixtures.id, id))
      .returning();
    if (!updated)
      return Response.json({ message: "Fixture not found" }, { status: 404 });
    if (status === "COMPLETED")
      await recomputeStandings(updated.bslLeagueDayId || undefined);
    await audit(user, "FIXTURE_STATUS_CHANGE", "bsl_fixtures", id, { status });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
