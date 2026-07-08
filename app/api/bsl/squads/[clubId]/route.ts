import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslSquadMembers,
  bslPlayers,
  users,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ clubId: string }> },
) {
  try {
    const { clubId: clubIdStr } = await params;
    const clubId = Number(clubIdStr);
    const [club] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, clubId))
      .limit(1);
    if (!club) return Response.json({ message: "Not found" }, { status: 404 });
    const squadMembers = await db
      .select()
      .from(bslSquadMembers)
      .where(eq(bslSquadMembers.bslClubId, clubId));
    const playerIds = squadMembers
      .map((m) => m.bslPlayerId)
      .filter((x): x is number => x != null);
    const players = playerIds.length
      ? await db
          .select()
          .from(bslPlayers)
          .where(inArray(bslPlayers.id, playerIds))
      : [];
    const userIds = players
      .map((p) => p.userId)
      .filter((x): x is number => x != null);
    const userRows = userIds.length
      ? await db
          .select({ id: users.id, fullName: users.fullName })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const uMap = new Map(userRows.map((u) => [u.id, u]));
    const pMap = new Map(
      players.map((p) => [
        p.id,
        {
          ...p,
          resolvedName:
            uMap.get(p.userId)?.fullName || p.displayName || `Player #${p.id}`,
        },
      ]),
    );
    return Response.json({
      ...club,
      squadMembers: squadMembers.map((m) => ({
        ...m,
        player: m.bslPlayerId != null ? pMap.get(m.bslPlayerId) || null : null,
      })),
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
