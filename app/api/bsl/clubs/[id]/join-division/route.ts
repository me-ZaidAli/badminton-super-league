import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import {
  bslClubs,
  bslLeagues,
  bslPlayers,
  bslWalletTransactions,
} from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";
import { audit, genRef } from "@/lib/server/utils";
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
    const body = await req.json();
    const division = String(body?.division ?? "").trim();
    if (!division)
      return Response.json({ message: "division required" }, { status: 400 });
    const { club, reason } = await loadClubForManager(user, id);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    const [league] = await db
      .select()
      .from(bslLeagues)
      .where(eq(bslLeagues.id, 1))
      .limit(1);
    if (!league)
      return Response.json(
        { message: "League not configured" },
        { status: 500 },
      );
    const knownDivisions: string[] = (league as any).divisions || [];
    if (knownDivisions.length && !knownDivisions.includes(division))
      return Response.json(
        { message: `Division "${division}" doesn't exist in this league` },
        { status: 400 },
      );
    if (division === club.division)
      return Response.json(
        { message: "Already your primary division" },
        { status: 400 },
      );
    const fee = Math.max(
      0,
      Number((league as any).divisionJoinFeePence ?? 2500),
    );
    const result = await db.transaction(async (tx) => {
      const clubLock = await tx.execute(
        sql`SELECT id, name, division, additional_divisions FROM bsl_clubs WHERE id = ${club.id} LIMIT 1 FOR UPDATE`,
      );
      const cRow: any = (clubLock as any).rows?.[0];
      if (!cRow)
        throw Object.assign(new Error("Club not found"), { status: 404 });
      const currentExtras: string[] = Array.isArray(cRow.additional_divisions)
        ? cRow.additional_divisions
        : [];
      if (division === cRow.division)
        throw Object.assign(new Error("Already your primary division"), {
          status: 400,
        });
      if (currentExtras.includes(division))
        throw Object.assign(new Error("Already joined that division"), {
          status: 409,
        });
      if (currentExtras.length >= 8)
        throw Object.assign(
          new Error("Maximum of 8 additional divisions reached"),
          { status: 400 },
        );
      let chargedPlayerId: number | null = null;
      let walletAfter: number | null = null;
      let txRow: any = null;
      if (fee > 0) {
        const lockedRows = await tx.execute(
          sql`SELECT id, wallet_balance FROM bsl_players WHERE user_id = ${user.id} AND bsl_club_id = ${club.id} LIMIT 1 FOR UPDATE`,
        );
        const row: any = (lockedRows as any).rows?.[0];
        if (!row)
          throw Object.assign(
            new Error(
              "You must be a confirmed BSL player in this club to pay the join fee",
            ),
            { status: 400 },
          );
        const balance = Number(row.wallet_balance ?? 0);
        if (balance < fee)
          throw Object.assign(
            new Error(
              `Insufficient wallet balance — need £${(fee / 100).toFixed(2)}, have £${(balance / 100).toFixed(2)}. Top up first.`,
            ),
            { status: 400 },
          );
        chargedPlayerId = row.id;
        walletAfter = balance - fee;
        await tx
          .update(bslPlayers)
          .set({ walletBalance: walletAfter })
          .where(eq(bslPlayers.id, row.id));
        [txRow] = await tx
          .insert(bslWalletTransactions)
          .values({
            bslPlayerId: row.id,
            type: "DEDUCTION",
            amount: fee,
            status: "APPROVED",
            reference: genRef("BSL-DIV"),
            description: `Division join · ${division} · ${cRow.name}`,
            reviewedById: user.id,
            reviewedAt: new Date(),
          })
          .returning();
      }
      const [updated] = await tx
        .update(bslClubs)
        .set({ additionalDivisions: [...currentExtras, division] })
        .where(eq(bslClubs.id, club.id))
        .returning();
      return { updated, chargedPlayerId, walletAfter, txRow };
    });
    await audit(user, "CLUB_JOIN_DIVISION", "bsl_club", club.id, {
      division,
      feePence: fee,
      chargedPlayerId: result.chargedPlayerId,
      walletAfterPence: result.walletAfter,
    });
    return Response.json({
      ok: true,
      club: result.updated,
      feePence: fee,
      walletAfterPence: result.walletAfter,
      transaction: result.txRow,
    });
  } catch (err: any) {
    const status = err?.status || 500;
    return Response.json(
      { message: err.message || "Failed to join division" },
      { status },
    );
  }
}
