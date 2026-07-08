import { NextResponse } from "next/server";

// Auth disabled.
export async function POST() {
  return NextResponse.json({ ok: true });
}
