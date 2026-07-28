import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/server/session";

export async function GET(req: NextRequest) {
  const user = await getSessionUser(req);
  if (!user) return NextResponse.json(null, { status: 401 });
  const { password, ...safe } = user as any;
  return NextResponse.json(safe);
}
