import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslTeams,
  bslPlayers,
  bslTeamMembers,
  bslLeagues,
  bslWalletTransactions,
  users,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
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
    const [club] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, id))
      .limit(1);
    if (!club)
      return Response.json({ message: "Club not found" }, { status: 404 });
    const teams = await db
      .select()
      .from(bslTeams)
      .where(eq(bslTeams.bslClubId, id));
    const teamIds = teams.map((t) => t.id);
    const members = teamIds.length
      ? await db
          .select()
          .from(bslTeamMembers)
          .where(inArray(bslTeamMembers.bslTeamId, teamIds))
      : [];
    const roster = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.bslClubId, id));
    const playerIds = roster.map((p) => p.id);
    const txRows = playerIds.length
      ? await db
          .select()
          .from(bslWalletTransactions)
          .where(inArray(bslWalletTransactions.bslPlayerId, playerIds))
      : [];
    const userIds = Array.from(new Set(roster.map((p) => p.userId)));
    const userRows = userIds.length
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const uMap = new Map(userRows.map((u) => [u.id, u]));
    return Response.json({
      club,
      teams: teams.map((t) => ({
        ...t,
        members: members
          .filter((m) => m.bslTeamId === t.id)
          .map((m) => m.bslPlayerId),
      })),
      roster: roster.map((p) => ({ ...p, user: uMap.get(p.userId) || null })),
      transactions: txRows,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
