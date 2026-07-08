import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPlayers, bslTeams, bslTeamMembers } from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ cat: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { cat } = await params;
    const category = cat.toUpperCase();
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
    const cur = me.categories || [];
    if (!cur.includes(category))
      return Response.json(
        { message: "Not registered for this category" },
        { status: 400 },
      );
    const myTeams = await db
      .select()
      .from(bslTeams)
      .where(eq(bslTeams.category, category));
    if (myTeams.length)
      await db.delete(bslTeamMembers).where(
        and(
          inArray(
            bslTeamMembers.bslTeamId,
            myTeams.map((t) => t.id),
          ),
          eq(bslTeamMembers.bslPlayerId, me.id),
        ),
      );
    const [updated] = await db
      .update(bslPlayers)
      .set({ categories: cur.filter((c) => c !== category) })
      .where(eq(bslPlayers.id, me.id))
      .returning();
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
