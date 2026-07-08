import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslTeams,
  bslTeamMembers,
  bslPlayers,
  users,
} from "@/lib/server/schema";
import { eq, inArray, and } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import {
  loadClubForManager,
  resolveFixtureDivision,
} from "@/lib/server/bsl-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; fixtureId: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr, fixtureId: fixtureIdStr } = await params;
    const id = Number(idStr);
    const fixtureId = Number(fixtureIdStr);
    const { club, reason } = await loadClubForManager(user, id);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    const [fixture] = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.id, fixtureId))
      .limit(1);
    if (!fixture)
      return Response.json({ message: "Fixture not found" }, { status: 404 });
    if (fixture.homeClubId !== id && fixture.awayClubId !== id)
      return Response.json(
        { message: "This match doesn't belong to your club" },
        { status: 403 },
      );
    const division = await resolveFixtureDivision(fixture);
    const allTeams = await db
      .select()
      .from(bslTeams)
      .where(eq(bslTeams.bslClubId, id));
    const matchScoped = allTeams.filter((t) => t.bslFixtureId === fixtureId);
    const base =
      matchScoped.length > 0
        ? matchScoped
        : division
          ? allTeams.filter(
              (t) => t.bslFixtureId == null && t.division === division,
            )
          : allTeams.filter((t) => t.bslFixtureId == null);
    const teamIds = base.map((t) => t.id);
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
    const playerMap = new Map(
      players.map((p) => [
        p.id,
        {
          ...p,
          name:
            p.displayName || uMap.get(p.userId)?.fullName || `Player #${p.id}`,
        },
      ]),
    );
    const pairs = base.map((t) => ({
      ...t,
      members: members
        .filter((m) => m.bslTeamId === t.id)
        .map((m) => playerMap.get(m.bslPlayerId))
        .filter(Boolean),
    }));
    return Response.json({ fixture, division, pairs });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
