import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse, getPagination } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

// Recruiter application list (ATS data source). Search/filter ready.
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get("orgId");
    if (!organizationId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
    const { membership } = await requireOrgAccess(organizationId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);
    const { page, limit, skip, take } = getPagination(sp);
    const where = {
      organizationId,
      ...(sp.get("jobId") ? { jobId: sp.get("jobId")! } : {}),
      ...(sp.get("stage") ? { stage: sp.get("stage")! } : {}),
      ...(sp.get("status") ? { status: sp.get("status")! } : {}),
    };
    const [total, items] = await Promise.all([
      prisma.application.count({ where }),
      prisma.application.findMany({
        where,
        include: {
          candidate: { include: { skills: true } },
          job: { select: { id: true, title: true } },
        },
        orderBy: { createdAt: "desc" },
        skip, take,
      }),
    ]);
    return successResponse(items, 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
