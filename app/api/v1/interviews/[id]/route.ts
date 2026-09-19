import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const i = await prisma.interview.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { sortOrder: "asc" } }, sessions: { orderBy: { createdAt: "desc" }, take: 20, include: { evaluations: true } } },
  });
  if (!i) return errorResponse("NOT_FOUND", "Interview could not be found.", 404);
  // Interview configs + other candidates' sessions are recruiter-only.
  try {
    const { membership } = await requireOrgAccess(i.organizationId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return errorResponse(status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", "Not authorized.", status);
  }
  return successResponse(i);
}
