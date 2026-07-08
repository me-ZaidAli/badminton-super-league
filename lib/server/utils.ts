import { db } from "./db";
import { bslAuditLog } from "./schema";

// ─── Audit log ─────────────────────────────────────────────────────────────

export async function audit(
  user: any,
  action: string,
  entity: string,
  entityId: number | null,
  detail?: any,
) {
  try {
    await db.insert(bslAuditLog).values({
      actorUserId: user?.id ?? null,
      actorRole: user?.role ?? null,
      action,
      entity,
      entityId: entityId ?? null,
      detail: detail ?? null,
    });
  } catch {
    /* never block on audit */
  }
}

// ─── URL sanitiser ─────────────────────────────────────────────────────────

/**
 * Sanitise a user-pasted URL before it gets stored and later rendered into
 * an <img src> or <a href>. Returns the cleaned string, or null if
 * empty/unsafe.  `mode` "image" also permits stored relative paths
 * (/files, /uploads); "link" requires an absolute http(s) URL.
 */
export function sanitiseUrl(value: any, mode: "image" | "link"): string | null {
  const s = String(value ?? "").trim();
  if (!s) return null;
  const capped = s.slice(0, 1000);
  if (mode === "image" && /^\/(files|uploads)\//i.test(capped)) return capped;
  try {
    const u = new URL(capped);
    if (u.protocol === "http:" || u.protocol === "https:") return capped;
  } catch {
    /* not a parseable absolute URL */
  }
  return null;
}

// ─── ID generators ─────────────────────────────────────────────────────────

export function genRef(prefix: string) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function genInvite() {
  return (
    Math.random().toString(36).slice(2, 8).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

// ─── Password hashing ───────────────────────────────────────────────────────

import bcrypt from "bcryptjs";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ─── Push notifications stub ────────────────────────────────────────────────
// Push rules live in the main app. We call back to the main server so BSL hub
// routes can still trigger notifications without duplicating the full system.
// Set MAIN_SERVER_URL in .env.local (defaults to http://localhost:5000).

export async function sendRulePush(
  rule: string,
  userIds: number[],
  data: Record<string, any>,
  opts?: { url?: string; dedupe?: { refType: string; refId: number } },
): Promise<void> {
  const base = process.env.MAIN_SERVER_URL ?? "http://localhost:5000";
  try {
    await fetch(`${base}/api/internal/bsl-push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-secret": process.env.INTERNAL_SECRET ?? "",
      },
      body: JSON.stringify({ rule, userIds, data, opts }),
    });
  } catch {
    // Non-fatal — notifications are best-effort
  }
}
