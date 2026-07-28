import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPrizes } from "@/lib/server/schema";
import { getSessionUser, isAdmin } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    const rows = await db
      .select()
      .from(bslPrizes)
      .orderBy(
        bslPrizes.division,
        bslPrizes.category,
        bslPrizes.sortOrder,
        bslPrizes.rank,
      );
    const filtered = isAdmin(user)
      ? rows
      : rows.filter((r) => r.isPublished);
    return Response.json(filtered);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
