import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslTeams,
  bslSquadMembers,
  bslPlayers,
  users,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";

export async function GET(_req: NextRequest) {
  try {
    const clubs = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.status, "ACTIVE" as any));
    const clubIds = clubs.map((c) => c.id);
    const teams = clubIds.length
      ? await db
          .select()
          .from(bslTeams)
          .where(inArray(bslTeams.bslClubId, clubIds))
      : [];
    return Response.json(
      clubs.map((c) => ({
        ...c,
        teams: teams.filter((t) => t.bslClubId === c.id),
      })),
    );
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
