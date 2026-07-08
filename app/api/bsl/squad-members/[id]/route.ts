import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslSquadMembers } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";
import { audit, sanitiseUrl } from "@/lib/server/utils";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [member] = await db
      .select()
      .from(bslSquadMembers)
      .where(eq(bslSquadMembers.id, id))
      .limit(1);
    if (!member)
      return Response.json({ message: "Member not found" }, { status: 404 });
    const { club, reason } = await loadClubForManager(user, member.bslClubId);
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
    const patch: any = {};
    if ("name" in body) {
      const n = String(body.name || "").trim();
      if (!n)
        return Response.json(
          { message: "Player name required" },
          { status: 400 },
        );
      patch.name = n.slice(0, 120);
    }
    if ("division" in body) patch.division = clean(body.division);
    if ("photoUrl" in body)
      patch.photoUrl = sanitiseUrl(body.photoUrl, "image");
    if ("linkUrl" in body) patch.linkUrl = sanitiseUrl(body.linkUrl, "link");
    if ("sortOrder" in body && Number.isFinite(Number(body.sortOrder)))
      patch.sortOrder = Number(body.sortOrder);
    if (!Object.keys(patch).length)
      return Response.json({ message: "Nothing to update" }, { status: 400 });
    const [row] = await db
      .update(bslSquadMembers)
      .set(patch)
      .where(eq(bslSquadMembers.id, id))
      .returning();
    await audit(
      user,
      "BSL_SQUAD_MEMBER_UPDATE",
      "bsl_squad_members",
      id,
      patch,
    );
    return Response.json(row);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [member] = await db
      .select()
      .from(bslSquadMembers)
      .where(eq(bslSquadMembers.id, id))
      .limit(1);
    if (!member)
      return Response.json({ message: "Member not found" }, { status: 404 });
    const { club, reason } = await loadClubForManager(user, member.bslClubId);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    await db.delete(bslSquadMembers).where(eq(bslSquadMembers.id, id));
    await audit(user, "BSL_SQUAD_MEMBER_DELETE", "bsl_squad_members", id, {
      clubId: member.bslClubId,
    });
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
