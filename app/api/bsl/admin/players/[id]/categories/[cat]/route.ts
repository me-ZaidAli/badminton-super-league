import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; cat: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { id: idStr, cat } = await params;
    const id = Number(idStr);
    const category = cat.toUpperCase();
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.id, id))
      .limit(1);
    if (!me)
      return Response.json({ message: "Player not found" }, { status: 404 });
    const cur = (me.categories || []) as string[];
    if (!cur.includes(category))
      return Response.json(
        { message: "Not registered for this category" },
        { status: 400 },
      );
    const [updated] = await db
      .update(bslPlayers)
      .set({ categories: cur.filter((c) => c !== category) })
      .where(eq(bslPlayers.id, id))
      .returning();
    await audit(user, "ADMIN_REMOVE_PLAYER_CATEGORY", "bsl_players", id, {
      category,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
