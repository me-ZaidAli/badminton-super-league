import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslMedia } from "@/lib/server/schema";
import { eq } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  try {
    const rows = await db
      .select()
      .from(bslMedia)
      .where(eq(bslMedia.isMvp, true));
    return Response.json(rows);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
