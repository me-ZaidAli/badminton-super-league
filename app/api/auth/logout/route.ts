import { NextRequest, NextResponse } from "next/server";
import {
  destroySessionByCookie,
  SESSION_COOKIE_NAME,
} from "@/lib/server/session";

export async function POST(req: NextRequest) {
  if (process.env.DISABLE_AUTH === "true") {
    return NextResponse.json({ ok: true });
  }
  const rawCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  await destroySessionByCookie(rawCookie);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
