import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgPermission } from "@/lib/auth/session";
import { signAssessmentInvite } from "@/lib/assessments/tokens";
import { audit } from "@/lib/audit/audit";

/**
 * Generate a signed assessment invite link for a candidate in this org.
 * Invite tokens are stateless (7 days by default) and bind candidate +
 * assessment + org, so forwarding a link to someone else does not grant access.
 */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = z
      .object({
        candidateId: z.string(),
        applicationId: z.string().optional(),
        expiresInDays: z.number().min(1).max(30).default(7),
      })
      .parse(await req.json());

    const assessment = await prisma.assessment.findUnique({
      where: { id: params.id },
      select: { id: true, organizationId: true, jobId: true, status: true, title: true },
    });
    if (!assessment) return errorResponse("NOT_FOUND", "Assessment could not be found.", 404);

    const { session } = await requireOrgPermission(assessment.organizationId, "assessments:manage");

    const candidate = await prisma.candidate.findFirst({
      where: {
        id: body.candidateId,
        deletedAt: null,
        OR: [
          { organizationId: assessment.organizationId },
          ...(assessment.jobId
            ? [{ applications: { some: { jobId: assessment.jobId } } }]
            : []),
        ],
      },
      select: { id: true, name: true, email: true },
    });
    if (!candidate) {
      return errorResponse("NOT_FOUND", "Candidate not found in this organization.", 404);
    }

    let applicationId = body.applicationId;
    if (applicationId) {
      const application = await prisma.application.findFirst({
        where: { id: applicationId, candidateId: candidate.id },
        select: { id: true },
      });
      if (!application) {
        return errorResponse("VALIDATION_ERROR", "Application does not belong to this candidate.", 400);
      }
    } else if (assessment.jobId) {
      const application = await prisma.application.findFirst({
        where: { candidateId: candidate.id, jobId: assessment.jobId },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      applicationId = application?.id;
    }

    const token = await signAssessmentInvite(
      {
        sub: candidate.id,
        assessmentId: assessment.id,
        organizationId: assessment.organizationId,
        candidateId: candidate.id,
        applicationId,
      },
      `${body.expiresInDays}d`
    );

    await audit({
      organizationId: assessment.organizationId,
      actorId: session.sub,
      action: "assessment.invite_created",
      resource: "assessment",
      resourceId: assessment.id,
      metadata: { candidateId: candidate.id, applicationId },
    });

    return successResponse(
      {
        token,
        path: `/candidate/assessments/${assessment.id}?invite=${token}`,
        candidate: { id: candidate.id, name: candidate.name, email: candidate.email },
        expiresInDays: body.expiresInDays,
      },
      201
    );
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse("VALIDATION_ERROR", "candidateId is required.", 400, e.flatten());
    }
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse(
      status === 403 ? "FORBIDDEN" : status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Could not create invite.",
      status
    );
  }
}
