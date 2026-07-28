import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslCategorySettings } from "@/lib/server/schema";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const rows = await db.select().from(bslCategorySettings);
    return Response.json(rows);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
