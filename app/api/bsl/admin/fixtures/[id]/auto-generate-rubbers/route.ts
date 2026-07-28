import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslFixtures,
  bslRubbers,
  bslTeams,
  bslTeamMembers,
  bslPlayers,
  bslClubs,
} from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import {
  ALLOWED_CATS,
  DEFAULT_CVC_TYPES,
  ALLOWED_RUBBER_TYPES,
  isGradeAllowedInDivision,
  loadCategorySettings,
  assertFixtureStructural,
} from "@/lib/server/bsl-helpers";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const [fixture] = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.id, id))
      .limit(1);
    if (!fixture)
      return Response.json({ message: "Fixture not found" }, { status: 404 });
    const errMsg = assertFixtureStructural(fixture);
    if (errMsg) return Response.json({ message: errMsg }, { status: 400 });
    const homeClubId = fixture.homeClubId!;
    const awayClubId = fixture.awayClubId!;
    const catSettings = await loadCategorySettings(null);
    const division = (fixture as any).division || null;
    const getTeamsForClub = async (clubId: number) => {
      const scopedTeams = await db
        .select()
        .from(bslTeams)
        .where(
          and(eq(bslTeams.bslClubId, clubId), eq(bslTeams.bslFixtureId, id)),
        );
      if (scopedTeams.length) return scopedTeams;
      const all = await db
        .select()
        .from(bslTeams)
        .where(eq(bslTeams.bslClubId, clubId));
      return division ? all.filter((t) => t.division === division) : all;
    };
    const homeTeams = await getTeamsForClub(homeClubId);
    const awayTeams = await getTeamsForClub(awayClubId);
    const cvcTypes = body.rubberTypes || DEFAULT_CVC_TYPES;
    await db.delete(bslRubbers).where(eq(bslRubbers.bslFixtureId, id));
    const rubberRows: any[] = [];
    let rubberNumber = 1;
    for (const type of cvcTypes) {
      if (!ALLOWED_RUBBER_TYPES.has(type)) continue;
      const catForType: Record<string, string[]> = {
        MD: ["MD"],
        WD: ["WD"],
        XD: ["XD"],
      };
      const cats = catForType[type] || [type];
      for (const cat of cats) {
        const hTeams = homeTeams.filter(
          (t) => !t.category || t.category === cat,
        );
        const aTeams = awayTeams.filter(
          (t) => !t.category || t.category === cat,
        );
        const pairs = Math.max(hTeams.length, aTeams.length, 1);
        for (let i = 0; i < pairs; i++) {
          rubberRows.push({
            bslFixtureId: id,
            rubberNumber,
            category: cat,
            homeTeamId: hTeams[i]?.id || null,
            awayTeamId: aTeams[i]?.id || null,
            label: `${cat} ${i + 1}`,
            status: "PENDING",
          });
          rubberNumber++;
        }
      }
    }
    const created = rubberRows.length
      ? await db
          .insert(bslRubbers)
          .values(rubberRows as any)
          .returning()
      : [];
    await audit(user, "AUTO_GENERATE_RUBBERS", "bsl_fixtures", id, {
      count: created.length,
      cvcTypes,
    });
    return Response.json({ rubbers: created });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
