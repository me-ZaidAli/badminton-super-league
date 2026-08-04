import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslWalletTransactions, bslPlayers, users } from "@/lib/server/schema";
import { desc, inArray } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);

    if (!user) return unauthorised();

    if (!isAdmin(user)) return forbidden();

    const all = await db
      .select()
      .from(bslWalletTransactions)
      .orderBy(desc(bslWalletTransactions.createdAt));
    const playerIds = Array.from(new Set(all.map((t) => t.bslPlayerId)));
    const players = playerIds.length
      ? await db
          .select({
            id: bslPlayers.id,
            userId: bslPlayers.userId,
            displayName: bslPlayers.displayName,
            paymentReference: bslPlayers.paymentReference,
          })
          .from(bslPlayers)
          .where(inArray(bslPlayers.id, playerIds))
      : [];

    const userIds = Array.from(
      new Set(
        players.map((p) => p.userId).filter((x): x is number => x != null),
      ),
    );
    
    const userRows = userIds.length
      ? await db
          .select({
            id: users.id,
            fullName: users.fullName,
            email: users.email,
          })
          .from(users)
          .where(inArray(users.id, userIds))
      : [];
    const uMap = new Map(userRows.map((u) => [u.id, u]));
    const pMap = new Map(
      players.map((p) => [p.id, { ...p, user: uMap.get(p.userId) || null }]),
    );
    const escCsv = (v: any) => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const header = [
      "ID",
      "PlayerID",
      "PlayerName",
      "Email",
      "PaymentRef",
      "Type",
      "Amount(£)",
      "Status",
      "Reference",
      "Description",
      "CreatedAt",
    ];
    const rows = all.map((t) => {
      const p = pMap.get(t.bslPlayerId);
      return [
        t.id,
        t.bslPlayerId,
        p?.user?.fullName || p?.displayName || "",
        p?.user?.email || "",
        p?.paymentReference || "",
        t.type,
        ((t.amount || 0) / 100).toFixed(2),
        t.status,
        t.reference || "",
        t.description || "",
        t.createdAt ? new Date(t.createdAt).toISOString() : "",
      ]
        .map(escCsv)
        .join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="bsl-payments-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
