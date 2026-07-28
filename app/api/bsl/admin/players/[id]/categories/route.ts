import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslPlayers,
  bslLeagues,
  bslWalletTransactions,
} from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit, genRef } from "@/lib/server/utils";

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
    const body = await req.json();
    const category = String(body.category || "").toUpperCase();
    const ALLOWED = new Set(["MD", "WD", "XD"]);
    if (!ALLOWED.has(category))
      return Response.json(
        { message: "category must be MD, WD, or XD" },
        { status: 400 },
      );
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.id, id))
      .limit(1);
    if (!me)
      return Response.json({ message: "Player not found" }, { status: 404 });
    const cur = (me.categories || []) as string[];
    if (cur.includes(category))
      return Response.json(
        { message: "Already registered for this category" },
        { status: 409 },
      );
    const [updated] = await db
      .update(bslPlayers)
      .set({ categories: [...cur, category] })
      .where(eq(bslPlayers.id, id))
      .returning();
    await audit(user, "ADMIN_ADD_PLAYER_CATEGORY", "bsl_players", id, {
      category,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
