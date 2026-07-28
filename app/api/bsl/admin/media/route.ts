import { NextRequest } from "next/server";
import { db } from "@/lib/server/db";
import { bslMedia } from "@/lib/server/schema";
import { desc } from "drizzle-orm";
import {
  getSessionUser,
  isAdmin,
  unauthorised,
  forbidden,
} from "@/lib/server/session";
import { parseUpload, saveBufferToBucket } from "@/lib/server/upload";
import { audit, sanitiseUrl } from "@/lib/server/utils";

export async function GET(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const rows = await db
      .select()
      .from(bslMedia)
      .orderBy(desc(bslMedia.createdAt));
    return Response.json(rows);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    if (!isAdmin(user)) return forbidden();
    const contentType = req.headers.get("content-type") || "";
    let url: string;
    let caption: string | null = null;
    let mediaType = "image";
    if (contentType.startsWith("multipart/")) {
      const { fileBuffer, filename } = await parseUpload(
        req,
        "file",
        10 * 1024 * 1024,
      );
      if (!fileBuffer)
        return Response.json({ message: "file required" }, { status: 400 });
      url = await saveBufferToBucket(fileBuffer, "bsl/media", filename);
      const ext = (filename || "").split(".").pop()?.toLowerCase() || "";
      if (["mp4", "mov", "webm"].includes(ext)) mediaType = "video";
    } else {
      const body = await req.json();
      url = sanitiseUrl(body.url, "image") || "";
      if (!url)
        return Response.json({ message: "url required" }, { status: 400 });
      caption = body.caption || null;
      mediaType = body.mediaType || "image";
    }
    const [created] = await db
      .insert(bslMedia)
      .values({ url, caption, mediaType, uploadedById: user.id } as any)
      .returning();
    await audit(user, "ADMIN_ADD_MEDIA", "bsl_media", created.id, { url });
    return Response.json(created);
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
