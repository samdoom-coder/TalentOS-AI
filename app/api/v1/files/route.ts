import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse } from "@/lib/utils";
import { getStorage } from "@/lib/storage/storage";
import { getSession, getMembership } from "@/lib/auth/session";
import { safeDownloadMime } from "@/lib/security/uploads";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

// Signed file access — never expose raw object-storage URLs.
// Requires an authenticated session scoped to the file's org (or the owning
// candidate via email match). Prevents IDOR via `?key=`.
export async function GET(req: NextRequest) {
  const rl = await checkRateLimit(rateLimitKey(req, "files:get"), 60, 60_000);
  if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many file requests.", 429);
  const key = req.nextUrl.searchParams.get("key");
  if (!key || key.includes("..") || key.startsWith("/") || !/^[a-zA-Z0-9\/._-]+$/.test(key)) {
    return errorResponse("VALIDATION_ERROR", "Valid key is required.", 400);
  }
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
  const file = await prisma.storedFile.findUnique({ where: { key } });
  if (!file) return errorResponse("NOT_FOUND", "File not found.", 404);
  // Authorize: org members of the file's org, or the candidate owner (email match).
  let authorized = false;
  if (file.organizationId) {
    const membership = await getMembership(session.sub, file.organizationId).catch(() => null);
    if (membership) authorized = true;
  }
  if (!authorized) {
    const owned = await prisma.candidateDocument.findFirst({
      where: { fileId: file.id, candidate: { email: session.email.toLowerCase() } },
    }).catch(() => null);
    if (owned) authorized = true;
  }
  if (!authorized) return errorResponse("FORBIDDEN", "Not authorized for this file.", 403);
  try {
    const data = await getStorage().read(key);
    return new Response(new Uint8Array(data), {
      headers: {
        "Content-Type": safeDownloadMime(file.mimeType),
        "Content-Disposition": `attachment; filename="${file.fileName.replace(/["\r\n]/g, "")}"`,
        "Cache-Control": "private, max-age=3600",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return errorResponse("NOT_FOUND", "File could not be read.", 404);
  }
}
