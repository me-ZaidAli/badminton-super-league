import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslTeams, bslClubs } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, isAdmin, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const teams = await db
      .select()
      .from(bslTeams)
      .where(eq(bslTeams.bslClubId, id));
    return Response.json(teams);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const { club, reason } = await loadClubForManager(user, id);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    const body = await req.json();
    const { name, category, division, pairNumber } = body;
    if (!name)
      return Response.json({ message: "name required" }, { status: 400 });
    const [created] = await db
      .insert(bslTeams)
      .values({
        bslClubId: id,
        name,
        category: category || null,
        division: division || club.division,
        pairNumber: pairNumber || null,
      } as any)
      .returning();
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
