import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import { getSessionUser, isAdminish, unauthorised } from "@/lib/server/session";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const [club] = await db
      .select()
      .from(bslClubs)
      .where(eq(bslClubs.id, id))
      .limit(1);
    if (!club)
      return Response.json({ message: "Club not found" }, { status: 404 });
    const owns =
      club.managerUserId === user.id ||
      (club as any).contactUserId === user.id ||
      (Array.isArray((club as any).adminUserIds) &&
        (club as any).adminUserIds.includes(user.id));
    if (!owns && !isAdminish(user))
      return Response.json({ message: "Not your club" }, { status: 403 });
    const body = await req.json();
    const amount = Math.trunc(Number(body.paymentAmountPence));
    const paymentDate = String(body.paymentDate || "").trim();
    const payerAccountName = String(body.payerAccountName || "")
      .trim()
      .slice(0, 120);
    if (!Number.isFinite(amount) || amount <= 0)
      return Response.json(
        { message: "Enter a positive payment amount." },
        { status: 400 },
      );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(paymentDate))
      return Response.json(
        { message: "Enter the date you sent the transfer (YYYY-MM-DD)." },
        { status: 400 },
      );
    if (payerAccountName.length < 2)
      return Response.json(
        { message: "Enter the bank account name you paid from." },
        { status: 400 },
      );
    const [updated] = await db
      .update(bslClubs)
      .set({
        paymentAmountPence: amount,
        paymentDate,
        payerAccountName,
        status: "PENDING_VERIFICATION",
      })
      .where(eq(bslClubs.id, id))
      .returning();
    return Response.json(updated);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
