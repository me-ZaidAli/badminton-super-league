import { NextRequest } from "next/server";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { recomputeStandings } from "@/lib/server/bsl-helpers";

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const body = await req.json().catch(() => ({}));
    const leagueDayId = body?.leagueDayId
      ? Number(body.leagueDayId)
      : undefined;
    await recomputeStandings(leagueDayId);
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
