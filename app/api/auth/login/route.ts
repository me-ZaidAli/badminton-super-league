import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import {
  createSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/server/session";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password: z.string().min(1).max(128),
});

// Pre-computed hash used to equalise response timing when the email is not
// found, so attackers can't detect registered emails via response latency.
const DUMMY_HASH = bcrypt.hashSync("timing-equalisation-dummy", 12);

export async function POST(req: NextRequest) {
  if (process.env.DISABLE_AUTH === "true") {
    return NextResponse.json({ message: "Auth is disabled" }, { status: 503 });
  }
  try {
    const body = await req.json().catch(() => null);
    const parsed = loginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }
    const { email, password } = parsed.data;

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Always run a bcrypt compare (against a dummy hash if the user doesn't
    // exist) and return a generic message either way — prevents email
    // enumeration via both the response body and response timing.
    const passwordOk = await bcrypt.compare(
      password,
      user?.password ?? DUMMY_HASH,
    );
    if (!user || !passwordOk) {
      return NextResponse.json(
        { message: "Invalid credentials" },
        { status: 401 },
      );
    }

    const cookieValue = await createSession(user.id);
    const sanitised = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      secondaryRoles: user.secondaryRoles,
      accountStatus: user.accountStatus,
      profilePictureUrl: user.profilePictureUrl,
      nickname: user.nickname,
    };
    const res = NextResponse.json(sanitised);
    res.cookies.set(SESSION_COOKIE_NAME, cookieValue, sessionCookieOptions());
    return res;
  } catch (err: any) {
    console.error("[auth/login]", err);
    return NextResponse.json({ message: "Failed to log in" }, { status: 500 });
  }
}
