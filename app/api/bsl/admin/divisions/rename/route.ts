import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslLeagues,
  bslLeagueDays,
  bslTeams,
} from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import { sql } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const body = await req.json();
    const { from: oldName, to: newName } = body;
    if (!oldName || !newName)
      return Response.json(
        { message: "from and to required" },
        { status: 400 },
      );
    if (oldName === newName)
      return Response.json({ message: "Names are identical" }, { status: 400 });
    await db
      .update(bslClubs)
      .set({ division: newName })
      .where(eq(bslClubs.division, oldName));
    await db
      .update(bslLeagueDays)
      .set({ division: newName })
      .where(eq(bslLeagueDays.division, oldName));
    await db
      .update(bslTeams)
      .set({ division: newName })
      .where(eq(bslTeams.division, oldName));
    const [league] = await db
      .select()
      .from(bslLeagues)
      .where(eq(bslLeagues.id, 1))
      .limit(1);
    if (league && Array.isArray(league.divisions)) {
      const updated = league.divisions.map((d: string) =>
        d === oldName ? newName : d,
      );
      await db
        .update(bslLeagues)
        .set({ divisions: updated })
        .where(eq(bslLeagues.id, 1));
    }
    await audit(user, "ADMIN_RENAME_DIVISION", "bsl_leagues", 1, {
      from: oldName,
      to: newName,
    });
    return Response.json({ ok: true, from: oldName, to: newName });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
