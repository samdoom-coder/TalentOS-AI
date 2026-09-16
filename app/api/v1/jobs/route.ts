import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse, getPagination, uniqueSlug } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { jobSchema } from "@/lib/validations";
import { audit } from "@/lib/audit/audit";
import { ensureWorkers } from "@/lib/bootstrap";

ensureWorkers();

async function orgId(req: NextRequest): Promise<string> {
  const id = req.nextUrl.searchParams.get("orgId") ?? req.headers.get("x-org-id");
  if (!id) throw Object.assign(new Error("orgId is required"), { status: 400 });
  return id;
}

export async function GET(req: NextRequest) {
  try {
    const organizationId = await orgId(req);
    const { membership } = await requireOrgAccess(organizationId);
    if (!can(membership.role, "jobs:view")) return errorResponse("FORBIDDEN", "No access to jobs.", 403);
    const { page, limit, skip, take } = getPagination(req.nextUrl.searchParams);
    const status = req.nextUrl.searchParams.get("status") ?? undefined;
    const q = req.nextUrl.searchParams.get("q") ?? undefined;
    const where = {
      organizationId,
      deletedAt: null,
      ...(status ? { status } : {}),
      ...(q ? { title: { contains: q } } : {}),
    };
    const [total, jobs] = await Promise.all([
      prisma.job.count({ where }),
      prisma.job.findMany({
        where,
        include: { _count: { select: { applications: true } }, requirements: true },
        orderBy: { createdAt: "desc" },
        skip,
        take,
      }),
    ]);
    return successResponse(jobs, 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed to list jobs.", status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const organizationId: string = body.organizationId ?? req.nextUrl.searchParams.get("orgId") ?? "";
    if (!organizationId) return errorResponse("VALIDATION_ERROR", "organizationId is required.", 400);
    const { membership, session } = await requireOrgAccess(organizationId);
    if (!can(membership.role, "jobs:create")) return errorResponse("FORBIDDEN", "Cannot create jobs.", 403);
    const input = jobSchema.parse(body);
    const job = await prisma.job.create({
      data: {
        organizationId,
        title: input.title,
        department: input.department,
        location: input.location,
        workMode: input.workMode,
        employmentType: input.employmentType,
        salaryMin: input.salaryMin,
        salaryMax: input.salaryMax,
        description: input.description,
        responsibilities: input.responsibilities,
        status: input.status,
        slug: uniqueSlug(input.title),
        publishedAt: input.status === "published" ? new Date() : null,
        createdById: session.sub,
        requirements: { create: input.requirements },
        questions: { create: input.questions.map((q, i) => ({ ...q, sortOrder: i })) },
      },
      include: { requirements: true, questions: true },
    });
    await audit({ organizationId, actorId: session.sub, action: "job.created", resource: "job", resourceId: job.id, metadata: { title: job.title } });
    return successResponse(job, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid job input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed to create job.", status);
  }
}
