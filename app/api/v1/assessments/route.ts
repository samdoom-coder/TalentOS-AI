import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { Jo } from "@/lib/db/json";
import { errorResponse, successResponse, getPagination } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { assessmentSchema } from "@/lib/validations";
import { audit } from "@/lib/audit/audit";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get("orgId");
    if (!organizationId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
    await requireOrgAccess(organizationId);
    const { page, limit, skip, take } = getPagination(sp);
    const where = { organizationId };
    const [total, items] = await Promise.all([
      prisma.assessment.count({ where }),
      prisma.assessment.findMany({
        where,
        include: { sections: { include: { questions: true } }, _count: { select: { attempts: true } } },
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const organizationId: string = body.organizationId;
    if (!organizationId) return errorResponse("VALIDATION_ERROR", "organizationId is required.", 400);
    const { membership, session } = await requireOrgAccess(organizationId);
    if (!can(membership.role, "assessments:manage")) return errorResponse("FORBIDDEN", "Cannot manage assessments.", 403);
    const input = assessmentSchema.parse(body);
    const assessment = await prisma.assessment.create({
      data: {
        organizationId,
        jobId: input.jobId,
        title: input.title,
        description: input.description,
        timeLimitMin: input.timeLimitMin,
        passingScore: input.passingScore,
        maxAttempts: input.maxAttempts,
        status: "published",
        sections: {
          create: input.sections.map((s, si) => ({
            title: s.title,
            sortOrder: si,
            questions: {
              create: s.questions.map((q, qi) => ({
                type: q.type,
                prompt: q.prompt,
                options: Jo(q.options),
                answerKey: Jo(q.answerKey),
                points: q.points,
                sortOrder: qi,
              })),
            },
          })),
        },
      },
      include: { sections: { include: { questions: true } } },
    });
    await audit({ organizationId, actorId: session.sub, action: "assessment.created", resource: "assessment", resourceId: assessment.id });
    return successResponse(assessment, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid assessment.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Create failed.", status);
  }
}
