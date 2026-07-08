import { cookies } from "next/headers";
import { NextRequest } from "next/server";
import cookieSig from "cookie-signature";
import pg from "pg";

const { Pool } = pg;

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
 * Read the express-session cookie, look up the session in PostgreSQL, and
 * return the authenticated user object (or null if not logged in / expired).
 *
 * Works with the main app's connect-pg-simple session store.
 * Session table schema: sid TEXT PK, sess JSONB, expire TIMESTAMPTZ
 */
export async function getSessionUser(req?: NextRequest): Promise<any | null> {
  if (process.env.DISABLE_AUTH === "true") return DEV_USER;
  try {
    const secret = process.env.SESSION_SECRET ?? "secret";

    // Read cookie — from NextRequest headers or server-side cookies()
    let rawCookie: string | undefined;
    if (req) {
      rawCookie = req.cookies.get("connect.sid")?.value;
    } else {
      const store = await cookies();
      rawCookie = store.get("connect.sid")?.value;
    }
    if (!rawCookie) return null;

    // URL-decode and strip the "s:" prefix added by express-session
    const decoded = decodeURIComponent(rawCookie);
    if (!decoded.startsWith("s:")) return null;
    const signed = decoded.slice(2);

    // Verify signature — returns false if tampered
    const sessionId = cookieSig.unsign(signed, secret);
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

export function isAdminish(user: any) {
  return user?.role === "OWNER" || user?.role === "ADMIN";
}
export function isOwner(user: any) {
  return user?.role === "OWNER";
}
