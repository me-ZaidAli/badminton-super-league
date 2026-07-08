import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs, bslTeams } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [club] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, id))
      .limit(1);
    if (!club) return Response.json({ message: "Not found" }, { status: 404 });
    const teams = await db
      .select()
      .from(bslTeams)
      .where(eq(bslTeams.bslClubId, id));
    return Response.json({ ...club, teams });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
