import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslPlayers,
  bslClubs,
  bslTeams,
  bslTeamMembers,
  bslWalletTransactions,
  bslLeagues,
  users,
} from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { computePlayerLeaderboard } from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const [me] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.userId, user.id))
      .limit(1);
    if (!me)
      return Response.json({
        player: null,
        club: null,
        teams: [],
        leaderboard: null,
        wallet: null,
      });
    const [club] = me.bslClubId
      ? await db
          .select()
          .from(bslClubs)
          .where(eq(bslClubs.id, me.bslClubId))
          .limit(1)
      : [null];
    const myTeamMemberships = await db
      .select()
      .from(bslTeamMembers)
      .where(eq(bslTeamMembers.bslPlayerId, me.id));
    const teamIds = myTeamMemberships.map((m) => m.bslTeamId);
    const teams = teamIds.length
      ? await db.select().from(bslTeams).where(inArray(bslTeams.id, teamIds))
      : [];
    const lb = await computePlayerLeaderboard();
    const myLb = lb.find((r) => r.playerId === me.id) || null;
    const txRows = await db
      .select()
      .from(bslWalletTransactions)
      .where(eq(bslWalletTransactions.bslPlayerId, me.id));
    return Response.json({
      player: me,
      club: club || null,
      teams,
      leaderboard: myLb,
      wallet: { balance: me.walletBalance || 0, transactions: txRows },
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
