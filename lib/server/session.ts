import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import cookieSig from "cookie-signature";
import { randomBytes } from "crypto";
import pg from "pg";
import { db } from "./db";
import { session as sessionTable } from "./schema";
import { eq } from "drizzle-orm";

const { Pool } = pg;

export const SESSION_COOKIE_NAME = "connect.sid";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Use a module-level pool for session lookups (lightweight, read-only queries)
let _sessionPool: InstanceType<typeof Pool> | null = null;
function getSessionPool() {
  if (!_sessionPool) {
    _sessionPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: false }
          : false,
      max: 3,
    });
  }
  return _sessionPool;
}

// ── DEV ONLY: auth bypassed ───────────────────────────────────────────────
const DEV_USER = {
  id: 1,
  fullName: "Dev Admin",
  email: "dev@bsl.local",
  role: "OWNER" as const,
  secondaryRoles: [] as string[],
  accountStatus: "APPROVED",
  profilePictureUrl: null,
  nickname: null,
};

/**
 * Return the session-signing secret. Refuses to run with a missing secret in
 * production so cookies are never signed with a guessable default.
 */
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET must be set in production");
  }
  return "dev-only-insecure-secret";
}

/**
 * Verify a raw `connect.sid` cookie value (URL-encoded, "s:<id>.<hmac>") and
 * return the underlying session id, or null if missing/tampered/malformed.
 */
function verifySessionCookie(rawCookie: string | undefined): string | null {
  if (!rawCookie) return null;
  try {
    const decoded = decodeURIComponent(rawCookie);
    if (!decoded.startsWith("s:")) return null;
    const signed = decoded.slice(2);
    const sessionId = cookieSig.unsign(signed, getSessionSecret());
    return sessionId || null;
  } catch {
    // Malformed URI encoding or other parse failure — treat as no session.
    return null;
  }
}

/**
 * Create a new session row for `userId` and return the signed cookie value
 * ready to be set as `connect.sid` (already prefixed with "s:", NOT yet
 * URL-encoded — the cookie API handles that).
 */
export async function createSession(userId: number): Promise<string> {
  const sessionId = randomBytes(24).toString("hex");
  const expire = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessionTable).values({
    sid: sessionId,
    sess: { passport: { user: userId }, cookie: { expires: expire.toISOString() } },
    expire,
  });
  return "s:" + cookieSig.sign(sessionId, getSessionSecret());
}

/** Delete the session row backing `rawCookie` (no-op if invalid/missing). */
export async function destroySessionByCookie(
  rawCookie: string | undefined,
): Promise<void> {
  const sessionId = verifySessionCookie(rawCookie);
  if (!sessionId) return;
  await db.delete(sessionTable).where(eq(sessionTable.sid, sessionId));
}

/** Cookie options shared by every place that sets/clears `connect.sid`. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  };
}

/**
 * Read the express-session cookie, look up the session in PostgreSQL, and
 * return the authenticated user object (or null if not logged in / expired).
 *
 * Works with the main app's connect-pg-simple session store.
 * Session table schema: sid TEXT PK, sess JSONB, expire TIMESTAMPTZ
 */
export async function getSessionUser(req?: NextRequest): Promise<any | null> {
  if (process.env.DISABLE_AUTH === "true") return DEV_USER;
  try {
    // Read cookie — from NextRequest headers or server-side cookies()
    let rawCookie: string | undefined;
    if (req) {
      rawCookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    } else {
      const store = await cookies();
      rawCookie = store.get(SESSION_COOKIE_NAME)?.value;
    }
    const sessionId = verifySessionCookie(rawCookie);
    if (!sessionId) return null;

    // Look up session in PostgreSQL
    const pool = getSessionPool();
    const result = await pool.query(
      "SELECT sess FROM session WHERE sid = $1 AND expire > NOW()",
      [sessionId],
    );
    if (!result.rows[0]) return null;

    const sess = result.rows[0].sess as any;
    const userId: number | undefined = sess?.passport?.user;
    if (!userId) return null;

    // Fetch the user row
    const userResult = await pool.query(
      'SELECT id, full_name AS "fullName", email, role, secondary_roles AS "secondaryRoles", account_status AS "accountStatus", profile_picture_url AS "profilePictureUrl", nickname FROM users WHERE id = $1',
      [userId],
    );
    return userResult.rows[0] ?? null;
  } catch {
    return null;
  }
}

/** Throw helpers — call inside route handlers */
export function unauthorised() {
  return Response.json({ message: "Not authenticated" }, { status: 401 });
}
export function forbidden() {
  return Response.json({ message: "Admin only" }, { status: 403 });
}
export function ownerOnly() {
  return Response.json({ message: "Owner only" }, { status: 403 });
}

export function isAdmin(user: any) {
  return user?.role === "OWNER" || user?.role === "ADMIN";
}
export function isOwner(user: any) {
  return user?.role === "OWNER";
}
