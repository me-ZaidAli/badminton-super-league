import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslLeagueDays } from "@/lib/server/schema";
import { desc } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  try {
    const rows = await db
      .select()
      .from(bslLeagueDays)
      .orderBy(desc(bslLeagueDays.date));
    return Response.json(
      rows.map((r) => ({
        id: r.id,
        date: r.date,
        venue: r.venue || null,
        state: (r as any).state || null,
      })),
    );
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
