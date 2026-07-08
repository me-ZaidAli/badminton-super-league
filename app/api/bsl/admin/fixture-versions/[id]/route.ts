import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslFixtureVersions } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [row] = await db
      .select()
      .from(bslFixtureVersions)
      .where(eq(bslFixtureVersions.id, id))
      .limit(1);
    if (!row)
      return Response.json({ message: "Version not found" }, { status: 404 });
    return Response.json(row);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
