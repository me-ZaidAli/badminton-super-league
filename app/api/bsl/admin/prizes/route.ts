import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPrizes } from "@/lib/server/schema";
import { desc } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const body = await req.json();
    const { division, position, prize, description, season } = body;
    if (!division || !position)
      return Response.json(
        { message: "division and position required" },
        { status: 400 },
      );
    const [created] = await db
      .insert(bslPrizes)
      .values({
        division,
        position,
        prize: prize || null,
        description: description || null,
        season: season || null,
      } as any)
      .returning();
    await audit(user, "ADMIN_CREATE_PRIZE", "bsl_prizes", created.id, {
      division,
      position,
    });
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
