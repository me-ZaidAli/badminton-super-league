import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslClubs,
  bslTeams,
  bslTeamMembers,
  bslPlayers,
  bslRubbers,
  bslLeagueDays,
  users,
} from "@/lib/server/schema";
import { eq, inArray, and } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [fixture] = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.id, id))
      .limit(1);
    if (!fixture)
      return Response.json({ message: "Fixture not found" }, { status: 404 });
    const [day] = fixture.bslLeagueDayId
      ? await db
          .select()
          .from(bslLeagueDays)
          .where(eq(bslLeagueDays.id, fixture.bslLeagueDayId))
          .limit(1)
      : [null];
    const clubIds = [fixture.homeClubId, fixture.awayClubId].filter(
      (x): x is number => x != null,
    );
    const clubs = clubIds.length
      ? await db.select().from(bslClubs).where(inArray(bslClubs.id, clubIds))
      : [];
    const teams = clubIds.length
      ? await db
          .select()
          .from(bslTeams)
          .where(inArray(bslTeams.bslClubId, clubIds))
      : [];
    const teamIds = teams.map((t) => t.id);
    const members = teamIds.length
      ? await db
          .select()
          .from(bslTeamMembers)
          .where(inArray(bslTeamMembers.bslTeamId, teamIds))
      : [];
    const playerIds = Array.from(new Set(members.map((m) => m.bslPlayerId)));
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
    const rubbers = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.bslFixtureId, id));
    return Response.json({
      fixture,
      day: day || null,
      clubs,
      teams,
      members,
      players: players.map((p) => ({
        ...p,
        fullName: uMap.get(p.userId)?.fullName || null,
      })),
      rubbers,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
