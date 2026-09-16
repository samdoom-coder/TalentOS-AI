import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { jobSchema } from "@/lib/validations";
import { audit } from "@/lib/audit/audit";
import { z } from "zod";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({
    where: { id: params.id },
    include: {
      requirements: true,
      questions: { orderBy: { sortOrder: "asc" } },
      _count: { select: { applications: true } },
    },
  });
  if (!job || job.deletedAt) return errorResponse("NOT_FOUND", "Job could not be found.", 404);
  return successResponse(job);
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    const job = await prisma.job.findUnique({ where: { id: params.id } });
    if (!job) return errorResponse("NOT_FOUND", "Job could not be found.", 404);
    const { membership, session } = await requireOrgAccess(job.organizationId);
    if (!can(membership.role, "jobs:edit")) return errorResponse("FORBIDDEN", "Cannot edit jobs.", 403);
    const input = jobSchema.partial().parse(body);
    const updated = await prisma.job.update({
      where: { id: params.id },
      data: {
        ...(input.title ? { title: input.title } : {}),
        ...(input.department !== undefined ? { department: input.department } : {}),
        ...(input.location !== undefined ? { location: input.location } : {}),
        ...(input.workMode ? { workMode: input.workMode } : {}),
        ...(input.employmentType ? { employmentType: input.employmentType } : {}),
        ...(input.salaryMin !== undefined ? { salaryMin: input.salaryMin } : {}),
        ...(input.salaryMax !== undefined ? { salaryMax: input.salaryMax } : {}),
        ...(input.description ? { description: input.description } : {}),
        ...(input.responsibilities !== undefined ? { responsibilities: input.responsibilities } : {}),
        ...(input.status ? { status: input.status, publishedAt: input.status === "published" ? (job.publishedAt ?? new Date()) : job.publishedAt } : {}),
        ...(input.requirements ? { requirements: { deleteMany: {}, create: input.requirements } } : {}),
      },
      include: { requirements: true },
    });
    await audit({ organizationId: job.organizationId, actorId: session.sub, action: "job.updated", resource: "job", resourceId: job.id });
    return successResponse(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Update failed.", status);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.job.findUnique({ where: { id: params.id } });
  if (!job) return errorResponse("NOT_FOUND", "Job could not be found.", 404);
  try {
    const { membership, session } = await requireOrgAccess(job.organizationId);
    if (!can(membership.role, "jobs:edit")) return errorResponse("FORBIDDEN", "Cannot delete jobs.", 403);
    await prisma.job.update({ where: { id: params.id }, data: { deletedAt: new Date(), status: "archived" } });
    await audit({ organizationId: job.organizationId, actorId: session.sub, action: "job.deleted", resource: "job", resourceId: job.id });
    return successResponse({ ok: true });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Delete failed.", status);
  }
}
