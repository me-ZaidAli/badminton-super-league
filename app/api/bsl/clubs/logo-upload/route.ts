import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { parseUpload, saveBufferToBucket } from "@/lib/server/upload";

export async function POST(req: NextRequest) {
  try {
    const { fileBuffer, filename } = await parseUpload(
      req,
      "logo",
      5 * 1024 * 1024,
    );
    if (!fileBuffer)
      return Response.json({ message: "logo file required" }, { status: 400 });

    let logoUrl: string;

    if (process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID) {
      logoUrl = await saveBufferToBucket(fileBuffer, "bsl/clubs", filename);
    } else {
      // Local dev fallback — save to public/uploads/clubs/
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "clubs");
      await mkdir(uploadsDir, { recursive: true });
      const safeName = `${Date.now()}-${filename.replace(/[^a-z0-9._-]/gi, "_")}`;
      await writeFile(path.join(uploadsDir, safeName), fileBuffer);
      logoUrl = `/uploads/clubs/${safeName}`;
    }

    return Response.json({ logoUrl });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
