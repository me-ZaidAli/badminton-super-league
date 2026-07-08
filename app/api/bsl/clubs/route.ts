import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslClubs, bslTeams, bslLeagues } from "@/lib/server/schema";
import { eq, desc } from "drizzle-orm";
import { getSessionUser, isAdminish, unauthorised } from "@/lib/server/session";
import { genRef } from "@/lib/server/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const all = await db
      .select()
      .from(bslClubs)
      .orderBy(desc(bslClubs.createdAt));
    const filtered = isAdminish(user)
      ? all
      : all.filter((c) => c.managerUserId === user.id || c.status === "ACTIVE");
    return Response.json(filtered);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const body = await req.json();
    const { name, division, categoryPairs, categories, logoUrl, clubId } = body;
    if (!name || !division)
      return Response.json(
        { message: "Name and division required" },
        { status: 400 },
      );
    const ALLOWED_CATEGORIES = ["MD", "WD", "XD"];
    const CATEGORY_SHORT: Record<string, string> = {
      MD: "MD",
      WD: "WD",
      XD: "XD",
    };
    const pairs: Record<string, number> = {};
    if (categoryPairs && typeof categoryPairs === "object") {
      for (const cat of ALLOWED_CATEGORIES) {
        const n = Number((categoryPairs as any)[cat]);
        if (Number.isFinite(n) && n > 0)
          pairs[cat] = Math.min(8, Math.floor(n));
      }
    } else if (Array.isArray(categories)) {
      for (const c of categories)
        if (typeof c === "string" && ALLOWED_CATEGORIES.includes(c))
          pairs[c] = 1;
    }
    const totalPairs = Object.values(pairs).reduce((s, n) => s + n, 0);
    if (totalPairs === 0)
      return Response.json(
        {
          message:
            "Register at least one pair across Men's, Women's, or Mixed Doubles",
        },
        { status: 400 },
      );
    const paymentReference = genRef("BSL-CLUB");
    const [created] = await db
      .insert(bslClubs)
      .values({
        name,
        division,
        teamCount: totalPairs,
        categories: Object.keys(pairs),
        categoryPairs: pairs,
        logoUrl: logoUrl || null,
        clubId: clubId || null,
        managerUserId: user.id,
        paymentReference,
        additionalDivisions: [],
      } as any)
      .returning();
    const teamRows: any[] = [];
    for (const cat of ALLOWED_CATEGORIES) {
      const count = pairs[cat] || 0;
      for (let i = 0; i < count; i++) {
        const letter = String.fromCharCode(65 + i);
        const suffix = count > 1 ? ` Pair ${letter}` : "";
        teamRows.push({
          bslClubId: created.id,
          name: `${created.name} ${CATEGORY_SHORT[cat]}${suffix}`,
          division: created.division,
          category: cat,
          pairNumber: i + 1,
        });
      }
    }
    if (teamRows.length) await db.insert(bslTeams).values(teamRows as any);
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
