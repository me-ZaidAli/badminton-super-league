import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslTeams,
  bslTeamMembers,
  bslPlayers,
  bslLeagues,
  bslWalletTransactions,
  users,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadOwnedClub } from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { club } = await loadOwnedClub(user);
    if (!club) return Response.json({ club: null });
    const teams = await db
      .select()
      .from(bslTeams)
      .where(eq(bslTeams.bslClubId, club.id));
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
      .where(eq(bslPlayers.bslClubId, club.id));
    const pending = roster.filter((p) => p.confirmedByOwnerAt == null);
    const confirmed = roster.filter((p) => p.confirmedByOwnerAt != null);
    const userIds = Array.from(new Set(roster.map((p) => p.userId)));
    const userRows = userIds.length
      ? await db
          .select({
            id: users.id,
            name: users.fullName,
            email: users.email,
            phone: users.phone,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const userMap = new Map(userRows.map((r) => [r.id, r]));
    const playerIds = roster.map((p) => p.id);
    const txRows = playerIds.length
      ? await db
          .select()
          .from(bslWalletTransactions)
          .where(inArray(bslWalletTransactions.bslPlayerId, playerIds))
      : [];
    const [league] = await db.select().from(bslLeagues).limit(1);
    const leagueFee = league?.playerFee || 0;
    const topupByPlayer = new Map<number, number>();
    const debitByPlayer = new Map<number, number>();
    for (const tx of txRows) {
      if (tx.type === "TOPUP" && tx.status === "APPROVED")
        topupByPlayer.set(
          tx.bslPlayerId,
          (topupByPlayer.get(tx.bslPlayerId) || 0) + tx.amount,
        );
      else if (tx.type === "DEDUCTION")
        debitByPlayer.set(
          tx.bslPlayerId,
          (debitByPlayer.get(tx.bslPlayerId) || 0) + tx.amount,
        );
    }
    const hydrate = (p: any) => {
      const topupTotal = topupByPlayer.get(p.id) || 0;
      const spent = debitByPlayer.get(p.id) || 0;
      return {
        ...p,
        user: userMap.get(p.userId) || null,
        paidTotal: topupTotal + (p.status === "ACTIVE" ? leagueFee : 0),
        spentTotal: spent,
      };
    };
    const summary = {
      roster: confirmed.length,
      pending: pending.length,
      matchesPlayed: confirmed.reduce((s, p) => s + (p.matchesPlayed || 0), 0),
      matchesWon: confirmed.reduce((s, p) => s + (p.matchesWon || 0), 0),
      moneyIn: confirmed.reduce(
        (s, p) =>
          s +
          (topupByPlayer.get(p.id) || 0) +
          (p.status === "ACTIVE" ? leagueFee : 0),
        0,
      ),
      pairs: teams.length,
    };
    return Response.json({
      club,
      teams: teams.map((t) => ({
        ...t,
        members: members
          .filter((m) => m.bslTeamId === t.id)
          .map((m) => m.bslPlayerId),
      })),
      pending: pending.map(hydrate),
      confirmed: confirmed.map(hydrate),
      summary,
      league: league
        ? {
            divisions: league.divisions || [],
            divisionJoinFeePence: (league as any).divisionJoinFeePence ?? 2500,
            playerGrades: (league as any).playerGrades || [],
          }
        : null,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
