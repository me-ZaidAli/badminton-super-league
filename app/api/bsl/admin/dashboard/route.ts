import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslPlayers,
  bslClubs,
  bslFixtures,
  bslRubbers,
  bslLeagueDays,
  bslWalletTransactions,
} from "@/lib/server/schema";
import { eq, or, desc, and } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { sql } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();

    if (!isAdmin(user)) return forbidden();

    const [playerCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bslPlayers);
    const [activePlayerCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bslPlayers)
      .where(eq(bslPlayers.status, "ACTIVE"));
    const [clubCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bslClubs);
    const [activeClubCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bslClubs)
      .where(eq(bslClubs.status, "ACTIVE"));
    const [pendingPlayerCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bslPlayers)
      .where(
        or(
          eq(bslPlayers.status, "PENDING_PAYMENT"),
          eq(bslPlayers.status, "PENDING_VERIFICATION"),
        ),
      );

    const [pendingClubCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bslClubs)
      .where(
        or(
          eq(bslClubs.status, "PENDING_PAYMENT"),
          eq(bslClubs.status, "PENDING_VERIFICATION"),
        ),
      );

    const [fixtureCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bslFixtures);

    const [completedFixtureCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(bslFixtures)
      .where(eq(bslFixtures.status, "FINISHED"));

    const recentDays = await db
      .select()
      .from(bslLeagueDays)
      .orderBy(desc(bslLeagueDays.date))
      .limit(5);

    const pendingTopups = await db
      .select()
      .from(bslWalletTransactions)
      .where(
        and(
          eq(bslWalletTransactions.status, "PENDING"),
          eq(bslWalletTransactions.type, "TOPUP"),
        ),
      )
      .limit(10);
      
    return Response.json({
      stats: {
        players: {
          total: Number(playerCount.count),
          active: Number(activePlayerCount.count),
          pending: Number(pendingPlayerCount.count),
        },
        clubs: {
          total: Number(clubCount.count),
          active: Number(activeClubCount.count),
          pending: Number(pendingClubCount.count),
        },
        fixtures: {
          total: Number(fixtureCount.count),
          completed: Number(completedFixtureCount.count),
        },
      },
      recentLeagueDays: recentDays,
      pendingTopups,
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
