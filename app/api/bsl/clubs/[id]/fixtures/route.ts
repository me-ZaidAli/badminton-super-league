import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslClubs,
  bslLeagueDays,
  bslTeams,
} from "@/lib/server/schema";
import { eq, or, inArray } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const { club, reason } = await loadClubForManager(user, id);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    const fixtures = await db
      .select()
      .from(bslFixtures)
      .where(
        or(eq(bslFixtures.homeClubId, id), eq(bslFixtures.awayClubId, id)),
      );
    const otherClubIds = Array.from(
      new Set(
        fixtures
          .map((f) => (f.homeClubId === id ? f.awayClubId : f.homeClubId))
          .filter((x): x is number => x != null),
      ),
    );
    const otherClubs = otherClubIds.length
      ? await db
          .select({ id: bslClubs.id, name: bslClubs.name })
          .from(bslClubs)
          .where(inArray(bslClubs.id, otherClubIds))
      : [];
    const clubNameMap = new Map(otherClubs.map((c) => [c.id, c.name]));
    const dayIds = Array.from(
      new Set(
        fixtures
          .map((f) => f.bslLeagueDayId)
          .filter((x): x is number => x != null),
      ),
    );
    const days = dayIds.length
      ? await db
          .select({
            id: bslLeagueDays.id,
            date: bslLeagueDays.date,
            division: bslLeagueDays.division,
            venue: bslLeagueDays.venue,
          })
          .from(bslLeagueDays)
          .where(inArray(bslLeagueDays.id, dayIds))
      : [];
    const dayMap = new Map(days.map((d) => [d.id, d]));
    const builtCounts = await db
      .select({ bslFixtureId: bslTeams.bslFixtureId })
      .from(bslTeams)
      .where(eq(bslTeams.bslClubId, id));
    const pairCountByFixture = new Map<number, number>();
    for (const t of builtCounts) {
      if (t.bslFixtureId != null)
        pairCountByFixture.set(
          t.bslFixtureId,
          (pairCountByFixture.get(t.bslFixtureId) || 0) + 1,
        );
    }
    const rows = fixtures
      .map((f) => {
        const side = f.homeClubId === id ? "home" : "away";
        const opponentId = side === "home" ? f.awayClubId : f.homeClubId;
        const day =
          f.bslLeagueDayId != null ? dayMap.get(f.bslLeagueDayId) : null;
        return {
          id: f.id,
          side,
          opponentName:
            opponentId != null
              ? clubNameMap.get(opponentId) || `Club #${opponentId}`
              : "TBC",
          division: day?.division || null,
          category: f.category || null,
          date: day?.date || f.startTime || null,
          venue: day?.venue || null,
          status: f.status,
          myPairCount: pairCountByFixture.get(f.id) || 0,
        };
      })
      .sort((a, b) => {
        const ta = a.date
          ? new Date(a.date).getTime()
          : Number.MAX_SAFE_INTEGER;
        const tb = b.date
          ? new Date(b.date).getTime()
          : Number.MAX_SAFE_INTEGER;
        return ta - tb;
      });
    return Response.json({ fixtures: rows });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
