import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslRubbers, bslFixtures } from "@/lib/server/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser, isAdmin, unauthorised } from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import {
  assertFixtureMutable,
  recomputeStandings,
  ALLOWED_SCORING,
  rubberRallyPoints,
  computeFixtureScore,
} from "@/lib/server/bsl-helpers";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const body = await req.json();
    const [rubber] = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.id, id))
      .limit(1);
    if (!rubber)
      return Response.json({ message: "Rubber not found" }, { status: 404 });
    const [fixture] = await db
      .select()
      .from(bslFixtures)
      .where(eq(bslFixtures.id, rubber.bslFixtureId))
      .limit(1);
    if (!fixture)
      return Response.json({ message: "Fixture not found" }, { status: 404 });
    const errMsg = await assertFixtureMutable(
      fixture.id,
      new Set(["SCORE"]),
      "SCORE",
    );
    if (errMsg) return Response.json({ message: errMsg }, { status: 400 });
    const settings = (fixture.rulesSnapshot as any) || {};
    const scoring = settings.scoring || "RALLY";
    if (!ALLOWED_SCORING.has(scoring))
      return Response.json(
        { message: `Bad scoring type: ${scoring}` },
        { status: 400 },
      );
    const setsToWin = Number(settings.setsToWin) || 2;
    const pointsToWin = Number(settings.pointsPerSet) || 21;
    const twoPointLead = settings.twoPointLead !== false;
    const maxPoints = Number(settings.maxPointsPerSet) || 30;
    const { sets: rawSets, walkover, retiredSide } = body;
    let status = rubber.status;
    let setsData: any[] = (rubber.setScores as any[]) || [];
    let homeScore = rubber.homeScore;
    let awayScore = rubber.awayScore;
    if (walkover) {
      const validSide = ["home", "away"].includes(walkover) ? walkover : null;
      if (!validSide)
        return Response.json(
          { message: "walkover must be 'home' or 'away'" },
          { status: 400 },
        );
      homeScore = walkover === "home" ? setsToWin : 0;
      awayScore = walkover === "away" ? setsToWin : 0;
      status = "FINISHED" as any;
      setsData = [];
      await db
        .update(bslRubbers)
        .set({
          setScores: setsData,
          homeScore,
          awayScore,
          status: "FINISHED" as any,
          walkoverWinner: validSide,
          retiredSide: null,
        } as any)
        .where(eq(bslRubbers.id, id));
    } else if (retiredSide) {
      const validSide = ["home", "away"].includes(retiredSide)
        ? retiredSide
        : null;
      if (!validSide)
        return Response.json(
          { message: "retiredSide must be 'home' or 'away'" },
          { status: 400 },
        );
      homeScore = retiredSide === "away" ? setsToWin : 0;
      awayScore = retiredSide === "home" ? setsToWin : 0;
      status = "FINISHED" as any;
      setsData = Array.isArray(rawSets) ? rawSets : setsData;
      await db
        .update(bslRubbers)
        .set({
          setScores: setsData,
          homeScore,
          awayScore,
          status: "FINISHED" as any,
          walkoverWinner: null,
          retiredSide: validSide,
        } as any)
        .where(eq(bslRubbers.id, id));
    } else if (Array.isArray(rawSets)) {
      setsData = rawSets.map((s: any, i: number) => {
        const hp = Math.max(0, Math.trunc(Number(s.homePoints ?? s.home ?? 0)));
        const ap = Math.max(0, Math.trunc(Number(s.awayPoints ?? s.away ?? 0)));
        return { setNumber: i + 1, homePoints: hp, awayPoints: ap };
      });
      let hw = 0;
      let aw = 0;
      for (const set of setsData) {
        const hWins =
          set.homePoints > set.awayPoints &&
          (set.homePoints >= pointsToWin || set.homePoints >= maxPoints) &&
          (!twoPointLead || set.homePoints - set.awayPoints >= 2);
        const aWins =
          set.awayPoints > set.homePoints &&
          (set.awayPoints >= pointsToWin || set.awayPoints >= maxPoints) &&
          (!twoPointLead || set.awayPoints - set.homePoints >= 2);
        if (hWins) hw++;
        else if (aWins) aw++;
      }
      homeScore = hw;
      awayScore = aw;
      status =
        hw >= setsToWin || aw >= setsToWin
          ? ("FINISHED" as any)
          : ("LIVE" as any);
      await db
        .update(bslRubbers)
        .set({
          setScores: setsData,
          homeScore,
          awayScore,
          status,
          walkoverWinner: null,
          retiredSide: null,
        } as any)
        .where(eq(bslRubbers.id, id));
    } else {
      return Response.json(
        { message: "Provide sets, walkover, or retiredSide" },
        { status: 400 },
      );
    }
    if (status === "FINISHED") {
      const allRubbers = await db
        .select()
        .from(bslRubbers)
        .where(eq(bslRubbers.bslFixtureId, fixture.id));
      const totalHome = allRubbers.filter(
        (r) => (r.homeScore || 0) > (r.awayScore || 0),
      ).length;
      const totalAway = allRubbers.filter(
        (r) => (r.awayScore || 0) > (r.homeScore || 0),
      ).length;
      const allDone = allRubbers.every((r) => r.status === "FINISHED");
      if (allDone) {
        await db
          .update(bslFixtures)
          .set({
            homeRubbers: totalHome,
            awayRubbers: totalAway,
            status: "FINISHED",
          })
          .where(eq(bslFixtures.id, fixture.id));
        await recomputeStandings(fixture.bslLeagueDayId || undefined);
      } else {
        await db
          .update(bslFixtures)
          .set({ homeRubbers: totalHome, awayRubbers: totalAway })
          .where(eq(bslFixtures.id, fixture.id));
      }
    }
    const [updated] = await db
      .select()
      .from(bslRubbers)
      .where(eq(bslRubbers.id, id))
      .limit(1);
    await audit(user, "RUBBER_SCORE_UPDATE", "bsl_rubbers", id, {
      homeScore,
      awayScore,
      status,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
