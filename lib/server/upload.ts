import path from "path";
import { Client } from "@replit/object-storage";

const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
export const objClient = new Client(bucketId ? { bucketId } : undefined);

const MIME_BY_EXT: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".pdf": "application/pdf",
};

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
]);

/**
 * Save a Buffer (from a multipart upload) to object storage.
 * Returns the public path, e.g. /files/bsl/1234-abc.png
 */
export async function saveBufferToBucket(
  buf: Buffer,
  prefix: string,
  originalname: string,
): Promise<string> {
  const safePrefix =
    prefix.replace(/[^a-z0-9/_-]/gi, "").replace(/^\/+|\/+$/g, "") || "misc";
  const ext = (path.extname(originalname || "").toLowerCase() || ".jpg").slice(
    0,
    8,
  );
  const key = `${safePrefix}/${Date.now()}-${Math.random().toString(36).slice(2)}${/^[.][a-z0-9]+$/i.test(ext) ? ext : ".jpg"}`;
  const r = await objClient.uploadFromBytes(key, buf);
  if (!r.ok)
    throw new Error(
      `Object storage upload failed: ${(r.error as any)?.message ?? r.error}`,
    );
  return `/files/${key}`;
}

/**
 * Parse a multipart/form-data NextRequest and return { fields, file }.
 * Throws if no file is present when required.
 */
export async function parseUpload(
  req: Request,
  fieldName = "file",
  maxBytes = 5 * 1024 * 1024,
): Promise<{
  fields: Record<string, string>;
  fileBuffer: Buffer;
  filename: string;
  mimeType: string;
}> {
  const formData = await req.formData();
  const fields: Record<string, string> = {};
  let fileBuffer: Buffer | null = null;
  let filename = "upload";
  let mimeType = "application/octet-stream";

  for (const [key, value] of formData.entries()) {
    if (key === fieldName && value instanceof File) {
      if (value.size > maxBytes) throw new Error("File too large");
      const arr = await value.arrayBuffer();
      fileBuffer = Buffer.from(arr);
      filename = value.name;
      mimeType = value.type;
    } else if (typeof value === "string") {
      fields[key] = value;
    }
  }

  if (!fileBuffer) throw new Error("No file uploaded");
  if (ALLOWED_MIME.size > 0 && !ALLOWED_MIME.has(mimeType)) {
    throw new Error("File type not allowed");
  }
  return { fields, fileBuffer, filename, mimeType };
}
