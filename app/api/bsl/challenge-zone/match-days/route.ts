import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslLeagueDays } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const sp = new URL(req.url).searchParams;
    const division = sp.get("division") || "";
    const all = await db.select().from(bslLeagueDays);
    const filtered = division
      ? all.filter((d) => d.division === division)
      : all;
    return Response.json(filtered);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
