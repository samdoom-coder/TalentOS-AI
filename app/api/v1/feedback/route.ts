import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/audit";

// Recruiter collaboration: notes, mentions, assignments, feedback (internal only).
export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      applicationId: z.string(),
      candidateId: z.string().optional(),
      body: z.string().min(1).max(5000),
      rating: z.number().min(1).max(5).optional(),
    }).parse(await req.json());
    const app = await prisma.application.findUnique({ where: { id: body.applicationId } });
    if (!app) return errorResponse("NOT_FOUND", "Application not found.", 404);
    const { membership, session } = await requireOrgAccess(app.organizationId);
    if (!can(membership.role, "feedback:submit")) return errorResponse("FORBIDDEN", "Cannot submit feedback.", 403);
    const fb = await prisma.candidateFeedback.create({
      data: { applicationId: body.applicationId, candidateId: body.candidateId ?? app.candidateId, authorId: session.sub, body: body.body, rating: body.rating },
    });
    await audit({ organizationId: app.organizationId, actorId: session.sub, action: "feedback.submitted", resource: "application", resourceId: app.id });
    return successResponse(fb, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid feedback.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
