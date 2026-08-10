import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
import { and, eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const code = new URL(req.url).searchParams.get("code")?.toUpperCase();
    if (!code)
      return Response.json({ message: "Code required" }, { status: 400 });
    const [club] = await db
      .select()
      .from(bslClubs)
      .where(and(eq(bslClubs.inviteCode, code), eq(bslClubs.status, "ACTIVE")))
      .limit(1);
    if (!club)
      return Response.json(
        { message: "Invalid invite code" },
        { status: 404 },
      );
    return Response.json(club);
  } catch (err: any) {
    console.error("validate-invite error", err);
    return Response.json({ message: "Failed to validate code" }, { status: 500 });
  }
}
