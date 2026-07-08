import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslPlayers,
  bslTeamMembers,
  bslTeams,
  bslLeagues,
  bslClubs,
} from "@/lib/server/schema";
import { eq, and, inArray } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";
import { audit } from "@/lib/server/utils";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr, playerId: playerIdStr } = await params;
    const id = Number(idStr);
    const playerId = Number(playerIdStr);
    const { club, reason } = await loadClubForManager(user, id);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    const [player] = await db
      .select()
      .from(bslPlayers)
      .where(and(eq(bslPlayers.id, playerId), eq(bslPlayers.bslClubId, id)))
      .limit(1);
    if (!player)
      return Response.json(
        { message: "Player not in your club" },
        { status: 404 },
      );
    await db
      .delete(bslTeamMembers)
      .where(eq(bslTeamMembers.bslPlayerId, playerId));
    await db
      .update(bslPlayers)
      .set({ bslClubId: null, bslTeamId: null, confirmedByOwnerAt: null })
      .where(eq(bslPlayers.id, playerId));
    await audit(user, "MANAGER_REMOVE_PLAYER", "bsl_players", playerId, {
      fromClub: id,
    });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; playerId: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr, playerId: playerIdStr } = await params;
    const clubId = Number(idStr);
    const playerId = Number(playerIdStr);
    const { club, reason } = await loadClubForManager(user, clubId);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    const [p] = await db
      .select()
      .from(bslPlayers)
      .where(eq(bslPlayers.id, playerId))
      .limit(1);
    if (!p)
      return Response.json({ message: "Player not found" }, { status: 404 });
    if (p.bslClubId !== clubId)
      return Response.json(
        { message: "Player not in this club" },
        { status: 403 },
      );
    const body = await req.json();
    const patch: any = {};
    if (typeof body.displayName === "string")
      patch.displayName = body.displayName.slice(0, 80);
    if (typeof body.bio === "string") patch.bio = body.bio.slice(0, 600);
    if (typeof body.division === "string") {
      const requested = body.division.trim();
      if (!requested)
        return Response.json(
          { message: "Division can't be blank." },
          { status: 400 },
        );
      const joined = new Set<string>([
        club.division,
        ...(Array.isArray((club as any).additionalDivisions)
          ? (club as any).additionalDivisions
          : []),
      ]);
      if (!joined.has(requested))
        return Response.json(
          {
            message: `Club doesn't play in "${requested}". Available: ${[...joined].join(", ")}.`,
          },
          { status: 400 },
        );
      if (requested !== (p.division || club.division)) {
        const memberships = await db
          .select()
          .from(bslTeamMembers)
          .where(eq(bslTeamMembers.bslPlayerId, playerId));
        if (memberships.length > 0)
          return Response.json(
            {
              message:
                "Player is already in a pair. Remove them from their pair(s) before switching divisions.",
            },
            { status: 409 },
          );
      }
      patch.division = requested;
    }
    if ("grade" in body) {
      const raw = body.grade;
      if (raw === null || raw === "") {
        patch.grade = null;
      } else if (typeof raw === "string") {
        const g = raw.trim().toUpperCase().slice(0, 12);
        if (g) {
          const [league] = await db
            .select()
            .from(bslLeagues)
            .where(eq(bslLeagues.id, 1))
            .limit(1);
          const known = ((league as any)?.playerGrades || []).map((x: any) =>
            String(x.code),
          );
          if (known.length && !known.includes(g))
            return Response.json(
              { message: `Unknown grade "${g}". Known: ${known.join(", ")}` },
              { status: 400 },
            );
          patch.grade = g;
        } else {
          patch.grade = null;
        }
      }
    }
    let categoryChanges: { added: string[]; removed: string[] } | null = null;
    if (Array.isArray(body.categories)) {
      const ALLOWED = new Set(["MS", "WS", "MD", "WD", "XD"]);
      const next = Array.from(
        new Set(
          body.categories
            .map((c: any) =>
              String(c || "")
                .trim()
                .toUpperCase(),
            )
            .filter((c: string) => ALLOWED.has(c)),
        ),
      ) as string[];
      const cur = (p.categories || []) as string[];
      const added = next.filter((c) => !cur.includes(c));
      const removed = cur.filter((c) => !next.includes(c));
      if (removed.length) {
        const teamsInRemoved = await db
          .select()
          .from(bslTeams)
          .where(
            and(
              eq(bslTeams.bslClubId, p.bslClubId || 0),
              inArray(bslTeams.category, removed as any),
            ),
          );
        if (teamsInRemoved.length)
          await db.delete(bslTeamMembers).where(
            and(
              inArray(
                bslTeamMembers.bslTeamId,
                teamsInRemoved.map((t) => t.id),
              ),
              eq(bslTeamMembers.bslPlayerId, playerId),
            ),
          );
      }
      patch.categories = next;
      categoryChanges = { added, removed };
    }
    if (!Object.keys(patch).length)
      return Response.json({ message: "Nothing to update" }, { status: 400 });
    const [updated] = await db
      .update(bslPlayers)
      .set(patch)
      .where(eq(bslPlayers.id, playerId))
      .returning();
    await audit(user, "MANAGER_UPDATE_PLAYER", "bsl_players", playerId, {
      ...patch,
      categoryChanges,
    });
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
