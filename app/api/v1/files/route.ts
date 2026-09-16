import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/utils";
import { getStorage } from "@/lib/storage/storage";

// Signed file access — never expose raw object-storage URLs.
export async function GET(req: NextRequest) {
  const key = req.nextUrl.searchParams.get("key");
  if (!key || key.includes("..")) return errorResponse("VALIDATION_ERROR", "Valid key is required.", 400);
  const file = await prisma.storedFile.findUnique({ where: { key } });
  if (!file) return errorResponse("NOT_FOUND", "File not found.", 404);
  try {
    const data = await getStorage().read(key);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": file.mimeType ?? "application/octet-stream",
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return errorResponse("NOT_FOUND", "File could not be read.", 404);
  }
}
