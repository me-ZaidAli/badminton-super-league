import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslRubbers,
  bslTeams,
  bslClubs,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { computeFixtureScore } from "@/lib/server/bsl-helpers";

export async function GET(req: NextRequest) {
  try {
    const status = new URL(req.url).searchParams.get("status") ?? undefined;
    const allFixtures = await db
      .select()
      .from(bslFixtures)
      .orderBy(bslFixtures.startTime);
    const all = status
      ? allFixtures.filter((f) => f.status === status)
      : allFixtures;
    const teams = await db.select().from(bslTeams);
    const clubs = await db.select().from(bslClubs);
    const fixtureIds = all.map((f) => f.id);
    const allRubbers = fixtureIds.length
      ? await db
          .select()
          .from(bslRubbers)
          .where(inArray(bslRubbers.bslFixtureId, fixtureIds))
      : [];
    const tMap = new Map(teams.map((t) => [t.id, t]));
    const cMap = new Map(clubs.map((c) => [c.id, c]));
    const rubbersByFixture = new Map<number, any[]>();
    for (const r of allRubbers) {
      const arr = rubbersByFixture.get(r.bslFixtureId) || [];
      arr.push(r);
      rubbersByFixture.set(r.bslFixtureId, arr);
    }
    const enriched = all.map((f) => {
      const ht = f.homeTeamId != null ? tMap.get(f.homeTeamId) : null;
      const at = f.awayTeamId != null ? tMap.get(f.awayTeamId) : null;
      const hc =
        f.homeClubId != null
          ? cMap.get(f.homeClubId)
          : ht
            ? cMap.get(ht.bslClubId)
            : null;
      const ac =
        f.awayClubId != null
          ? cMap.get(f.awayClubId)
          : at
            ? cMap.get(at.bslClubId)
            : null;
      return {
        ...f,
        ...computeFixtureScore(rubbersByFixture.get(f.id) || []),
        homeClubId: hc?.id ?? f.homeClubId ?? null,
        awayClubId: ac?.id ?? f.awayClubId ?? null,
        homeTeamName: ht?.name || hc?.name || "TBD",
        awayTeamName: at?.name || ac?.name || "TBD",
        homeClubName: hc?.name || null,
        awayClubName: ac?.name || null,
        homeClubLogo: hc?.logoUrl || null,
        awayClubLogo: ac?.logoUrl || null,
      };
    });
    return Response.json(enriched);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const { homeTeamId, awayTeamId, court, startTime, bslLeagueDayId } =
      await req.json();
    const [created] = await db
      .insert(bslFixtures)
      .values({
        homeTeamId,
        awayTeamId,
        court: court || null,
        startTime: startTime ? new Date(startTime) : null,
        bslLeagueDayId: bslLeagueDayId || null,
      } as any)
      .returning();
    const types = ["MS1", "MS2", "WS", "MD", "WD", "XD"] as const;
    await db
      .insert(bslRubbers)
      .values(
        types.map((t, i) => ({
          bslFixtureId: created.id,
          rubberNumber: i + 1,
          rubberType: t,
        })),
      );
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
