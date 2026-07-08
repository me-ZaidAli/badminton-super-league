import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslSquadMembers, bslPlayers } from "@/lib/server/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";
import { audit, sanitiseUrl } from "@/lib/server/utils";
import { sql } from "drizzle-orm";

export async function POST(
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
    const body = await req.json();
    const clean = (v: any) => {
      const s = String(v ?? "").trim();
      return s.length ? s.slice(0, 1000) : null;
    };
    const photoUrl = sanitiseUrl(body.photoUrl, "image");
    const linkUrl = sanitiseUrl(body.linkUrl, "link");
    const rawPlayerId = Number(body.bslPlayerId);
    const bslPlayerId =
      Number.isFinite(rawPlayerId) && rawPlayerId > 0 ? rawPlayerId : null;
    if (bslPlayerId) {
      const [pl] = await db
        .select()
        .from(bslPlayers)
        .where(
          and(eq(bslPlayers.id, bslPlayerId), eq(bslPlayers.bslClubId, id)),
        )
        .limit(1);
      if (!pl)
        return Response.json(
          { message: "Player not in this club" },
          { status: 400 },
        );
      const nameOverride = String(body.name || "")
        .trim()
        .slice(0, 120);
      const [row] = await db
        .insert(bslSquadMembers)
        .values({
          bslClubId: id,
          bslPlayerId,
          name: nameOverride,
          division: clean(body.division),
          photoUrl,
          linkUrl,
          sortOrder: 0,
        })
        .onConflictDoUpdate({
          target: [bslSquadMembers.bslClubId, bslSquadMembers.bslPlayerId],
          targetWhere: sql`bsl_player_id IS NOT NULL`,
          set: {
            name: nameOverride,
            division: clean(body.division),
            photoUrl,
            linkUrl,
          },
        })
        .returning();
      await audit(
        user,
        "BSL_SQUAD_MEMBER_UPSERT",
        "bsl_squad_members",
        row.id,
        { clubId: id, bslPlayerId },
      );
      return Response.json(row);
    }
    const name = String(body.name || "").trim();
    if (!name)
      return Response.json(
        { message: "Player name required" },
        { status: 400 },
      );
    const [row] = await db
      .insert(bslSquadMembers)
      .values({
        bslClubId: id,
        name: name.slice(0, 120),
        division: clean(body.division),
        photoUrl,
        linkUrl,
        sortOrder: Number.isFinite(Number(body.sortOrder))
          ? Number(body.sortOrder)
          : 0,
      })
      .returning();
    await audit(user, "BSL_SQUAD_MEMBER_CREATE", "bsl_squad_members", row.id, {
      clubId: id,
    });
    return Response.json(row);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
