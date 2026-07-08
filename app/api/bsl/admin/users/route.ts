import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { users } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  isOwner,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit, hashPassword, genRef } from "@/lib/server/utils";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const body = await req.json();
    const { email, fullName, password, role } = body;
    if (!email || !fullName || !password)
      return Response.json(
        { message: "email, fullName, and password required" },
        { status: 400 },
      );
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);
    if (existing.length)
      return Response.json(
        { message: "Email already in use" },
        { status: 409 },
      );
    const hashedPassword = await hashPassword(password);
    const [created] = await db
      .insert(users)
      .values({
        email: email.toLowerCase().trim(),
        fullName,
        passwordHash: hashedPassword,
        role: role || "user",
      } as any)
      .returning({
        id: users.id,
        fullName: users.fullName,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });
    await audit(user, "ADMIN_CREATE_USER", "users", created.id, {
      email: created.email,
      role: created.role,
    });
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
