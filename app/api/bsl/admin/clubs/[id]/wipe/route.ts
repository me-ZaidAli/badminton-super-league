import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslPlayers,
  bslTeams,
  bslTeamMembers,
  bslFixtures,
  bslRubbers,
} from "@/lib/server/schema";
import { eq, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isOwner,
  unauthorised,
  ownerOnly,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isOwner(user)) return ownerOnly();
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
    if (teams.length)
      await db.delete(bslTeamMembers).where(
        inArray(
          bslTeamMembers.bslTeamId,
          teams.map((t) => t.id),
        ),
      );
    await db.delete(bslTeams).where(eq(bslTeams.bslClubId, id));
    await db
      .update(bslPlayers)
      .set({ bslClubId: null, bslTeamId: null, confirmedByOwnerAt: null })
      .where(eq(bslPlayers.bslClubId, id));
    const fixtures = await db
      .select({ id: bslFixtures.id })
      .from(bslFixtures)
      .where(eq(bslFixtures.homeClubId, id));
    if (fixtures.length)
      await db.delete(bslRubbers).where(
        inArray(
          bslRubbers.bslFixtureId,
          fixtures.map((f) => f.id),
        ),
      );
    await db.delete(bslFixtures).where(eq(bslFixtures.homeClubId, id));
    await db.delete(bslClubs).where(eq(bslClubs.id, id));
    await audit(user, "OWNER_WIPE_CLUB", "bsl_clubs", id, { name: club.name });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
