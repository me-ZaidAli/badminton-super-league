import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import {
  createSession,
  sessionCookieOptions,
  SESSION_COOKIE_NAME,
} from "@/lib/server/session";

const registerSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required").max(120),
  email: z.string().trim().toLowerCase().email("Invalid email").max(254),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(72, "Password must be at most 72 characters"),
});

export async function POST(req: NextRequest) {
  if (process.env.DISABLE_AUTH === "true") {
    return NextResponse.json({ message: "Auth is disabled" }, { status: 503 });
  }
  try {
    const body = await req.json().catch(() => null);
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: parsed.error.issues[0]?.message ?? "Invalid input" },
        { status: 400 },
      );
    }
    const { fullName, email, password } = parsed.data;

    const passwordHash = await bcrypt.hash(password, 12);

    let created;
    try {
      [created] = await db
        .insert(users)
        .values({
          fullName,
          email,
          password: passwordHash,
          role: "PLAYER",
          accountStatus: "APPROVED",
          emailVerified: false,
        } as any)
        .returning({
          id: users.id,
          fullName: users.fullName,
          email: users.email,
          role: users.role,
          secondaryRoles: users.secondaryRoles,
          accountStatus: users.accountStatus,
          profilePictureUrl: users.profilePictureUrl,
          nickname: users.nickname,
        });
    } catch (err: any) {
      const code = err?.code ?? err?.cause?.code;
      if (code === "23505") {
        return NextResponse.json(
          { message: "An account with that email already exists" },
          { status: 409 },
        );
      }
      throw err;
    }

    const cookieValue = await createSession(created.id);
    const res = NextResponse.json(created, { status: 201 });
    res.cookies.set(SESSION_COOKIE_NAME, cookieValue, sessionCookieOptions());
    return res;
  } catch (err: any) {
    // Don't leak internal error details (SQL text, hashed password, etc.) to the client.
    console.error("[auth/register]", err);
    return NextResponse.json(
      { message: "Failed to register" },
      { status: 500 },
    );
  }
}
