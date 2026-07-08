import { NextRequest } from "next/server";
import { computePlayerLeaderboard } from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const division = new URL(req.url).searchParams.get("division") ?? undefined;
    return Response.json(await computePlayerLeaderboard(division));
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
