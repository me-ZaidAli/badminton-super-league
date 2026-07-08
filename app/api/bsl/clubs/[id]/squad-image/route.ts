import { NextRequest } from "next/server";
import { getSessionUser, unauthorised } from "@/lib/server/session";
import { loadClubForManager } from "@/lib/server/bsl-helpers";
import { parseUpload, saveBufferToBucket } from "@/lib/server/upload";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getSessionUser(req);
    if (!user) return unauthorised();
    const { id: idStr } = await params;
    const id = Number(idStr);
    const { club, reason } = await loadClubForManager(user, id);
    if (!club)
      return Response.json(
        { message: reason || "Not found" },
        { status: reason === "Not your club" ? 403 : 404 },
      );
    const { fileBuffer, filename } = await parseUpload(
      req,
      "file",
      5 * 1024 * 1024,
    );
    if (!fileBuffer)
      return Response.json({ message: "file required" }, { status: 400 });
    const url = await saveBufferToBucket(fileBuffer, "bsl/squads", filename);
    return Response.json({ url });
  } catch (err: any) {
    return Response.json({ message: err.message }, { status: 500 });
  }
}
