import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslLeagueDays } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import {
  ALLOWED_LIFECYCLE_STATES,
  STATE_TRANSITIONS,
} from "@/lib/server/bsl-helpers";

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
    const nextState = String(body.state || "").toUpperCase();
    if (!ALLOWED_LIFECYCLE_STATES.has(nextState))
      return Response.json(
        {
          message: `Invalid state. Allowed: ${[...ALLOWED_LIFECYCLE_STATES].join(", ")}`,
        },
        { status: 400 },
      );
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
    const current = (day as any).state || "PLANNED";
    const allowedSet = STATE_TRANSITIONS[current] || new Set<string>();
    if (!allowedSet.has(nextState))
      return Response.json(
        {
          message: `Cannot transition from ${current} to ${nextState}. Allowed: ${[...allowedSet].join(", ")}`,
        },
        { status: 409 },
      );
    const [updated] = await db
      .update(bslLeagueDays)
      .set({ state: nextState } as any)
      .where(eq(bslLeagueDays.id, id))
      .returning();
    await audit(user, "LEAGUE_DAY_STATE_CHANGE", "bsl_league_days", id, {
      from: current,
      to: nextState,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
