import { NextRequest } from "next/server";
import { computePlayerLeaderboard } from "@/lib/server/bsl-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: idStr } = await params;
    const id = Number(idStr);
    if (!Number.isFinite(id))
      return Response.json({ message: "Bad id" }, { status: 400 });
    const rows = await computePlayerLeaderboard();
    const found = rows.find((r) => r.playerId === id);
    if (!found)
      return Response.json(
        { message: "No stats for this player yet" },
        { status: 404 },
      );
    return Response.json(found);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
