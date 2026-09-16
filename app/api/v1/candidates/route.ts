import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse, getPagination } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

// Powerful candidate search + filters. Designed for future semantic/vector backends.
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get("orgId");
    if (!organizationId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
    const { membership } = await requireOrgAccess(organizationId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);

    const { page, limit, skip, take } = getPagination(sp);
    const q = sp.get("q")?.trim();
    const skill = sp.get("skill")?.trim();
    const location = sp.get("location")?.trim();
    const minYears = sp.get("minYears") ? Number(sp.get("minYears")) : undefined;
    const minScore = sp.get("minScore") ? Number(sp.get("minScore")) : undefined;
    const maxScore = sp.get("maxScore") ? Number(sp.get("maxScore")) : undefined;
    const stage = sp.get("stage") ?? undefined;
    const jobId = sp.get("jobId") ?? undefined;

    const where = {
      organizationId,
      deletedAt: null,
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { title: { contains: q } }] } : {}),
      ...(location ? { location: { contains: location } } : {}),
      ...(minYears !== undefined ? { experienceYrs: { gte: minYears } } : {}),
      ...(skill ? { skills: { some: { skill: { contains: skill } } } } : {}),
      ...(jobId || stage || minScore !== undefined || maxScore !== undefined
        ? {
            applications: {
              some: {
                ...(jobId ? { jobId } : { job: { organizationId } }),
                ...(stage ? { stage } : {}),
                ...(minScore !== undefined || maxScore !== undefined
                  ? { matchScore: { ...(minScore !== undefined ? { gte: minScore } : {}), ...(maxScore !== undefined ? { lte: maxScore } : {}) } }
                  : {}),
              },
            },
          }
        : {}),
    };

    const [total, items] = await Promise.all([
      prisma.candidate.count({ where }),
      prisma.candidate.findMany({
        where,
        include: {
          skills: { take: 10 },
          applications: { include: { job: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 5 },
          scores: { orderBy: { createdAt: "desc" }, take: 3 },
        },
        orderBy: { createdAt: "desc" },
        skip, take,
      }),
    ]);
    return successResponse(items, 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Search failed.", status);
  }
}
