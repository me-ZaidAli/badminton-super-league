import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, users } from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const [p] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    return Response.json(p || null);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const body = await req.json();
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (!me)
      return Response.json(
        { message: "No BSL player profile yet" },
        { status: 404 },
      );
    const patch: any = {};
    if (typeof body.displayName === "string")
      patch.displayName = body.displayName.slice(0, 80);
    if (typeof body.bio === "string") patch.bio = body.bio.slice(0, 600);
    if (!Object.keys(patch).length)
      return Response.json({ message: "Nothing to update" }, { status: 400 });
    const [updated] = await db
      .update(bslPlayers)
      .set(patch)
      .where(eq(bslPlayers.id, me.id))
      .returning();
    await audit(user, "PLAYER_UPDATE_PROFILE", "bsl_players", me.id, patch);
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
