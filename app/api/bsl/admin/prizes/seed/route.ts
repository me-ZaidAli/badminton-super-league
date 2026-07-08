import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslPrizes, bslLeagues } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

const DEFAULT_PRIZES = [
  { position: 1, prize: "Gold Medal", description: "1st Place Trophy" },
  { position: 2, prize: "Silver Medal", description: "2nd Place Trophy" },
  { position: 3, prize: "Bronze Medal", description: "3rd Place Trophy" },
];

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const body = await req.json();
    const { season } = body;
    const [league] = await db
      .select()
      .from(bslLeagues)
      .where(eq(bslLeagues.id, 1))
      .limit(1);
    const divisions: string[] = (league?.divisions as any) || [];
    if (!divisions.length)
      return Response.json(
        { message: "No divisions configured in league" },
        { status: 400 },
      );
    const rows: any[] = [];
    for (const division of divisions) {
      for (const p of DEFAULT_PRIZES) {
        rows.push({
          division,
          position: p.position,
          prize: p.prize,
          description: p.description,
          season: season || null,
        });
      }
    }
    const created = rows.length
      ? await db
          .insert(bslPrizes)
          .values(rows as any)
          .returning()
      : [];
    await audit(user, "ADMIN_SEED_PRIZES", "bsl_prizes", 0, {
      count: created.length,
      divisions,
    });
    return Response.json({ prizes: created, count: created.length });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
