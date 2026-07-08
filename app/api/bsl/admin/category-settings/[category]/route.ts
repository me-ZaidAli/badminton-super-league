import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslCategorySettings } from "@/lib/server/schema";
import { eq } from "drizzle-orm";
import {
  getSessionUser,
  isAdminish,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { audit } from "@/lib/server/utils";
import { ALLOWED_CATS, sanitiseSettings } from "@/lib/server/bsl-helpers";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { category } = await params;
    if (!(ALLOWED_CATS as readonly string[]).includes(category))
      return Response.json(
        { message: `Category must be one of ${ALLOWED_CATS.join(", ")}` },
        { status: 400 },
      );
    const body = await req.json();
    const settings = sanitiseSettings(body.settings || body);
    const [existing] = await db
      .select()
      .from(bslCategorySettings)
      .where(eq(bslCategorySettings.category, category))
      .limit(1);
    let row: any;
    if (existing) {
      [row] = await db
        .update(bslCategorySettings)
        .set({ settings } as any)
        .where(eq(bslCategorySettings.category, category))
        .returning();
    } else {
      [row] = await db
        .insert(bslCategorySettings)
        .values({ category, settings } as any)
        .returning();
    }
    await audit(
      user,
      "ADMIN_UPSERT_CATEGORY_SETTINGS",
      "bsl_category_settings",
      row.id,
      { category },
    );
    return Response.json(row);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ category: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdminish(user)) return forbidden();
    const { category } = await params;
    await db
      .delete(bslCategorySettings)
      .where(eq(bslCategorySettings.category, category));
    await audit(
      user,
      "ADMIN_DELETE_CATEGORY_SETTINGS",
      "bsl_category_settings",
      0,
      { category },
    );
    return Response.json({ ok: true });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
