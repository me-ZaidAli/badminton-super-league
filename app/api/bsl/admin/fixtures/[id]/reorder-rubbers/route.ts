import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslRubbers, bslFixtures } from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
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
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const orderedIds: number[] = Array.isArray(body.ids)
      ? body.ids.map(Number)
      : [];
    if (!orderedIds.length)
      return Response.json({ message: "ids required" }, { status: 400 });
    const existing = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.bslFixtureId, id));
    const existingIds = new Set(existing.map((r) => r.id));
    if (!orderedIds.every((rid) => existingIds.has(rid)))
      return Response.json(
        { message: "ids don't match this fixture's rubbers" },
        { status: 400 },
      );
    for (let i = 0; i < orderedIds.length; i++) {
      await db
        .update(bslRubbers)
        .set({ rubberNumber: i + 1 })
        .where(eq(bslRubbers.id, orderedIds[i]));
    }
    await audit(user, "REORDER_RUBBERS", "bsl_fixtures", id, { orderedIds });
    const updated = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.bslFixtureId, id));
    return Response.json({
      rubbers: updated.sort((a, b) => a.rubberNumber - b.rubberNumber),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
