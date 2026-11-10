import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

// Session lifecycle for AI text/voice interviews.
// POST /api/v1/interviews/[id]/sessions -> create + welcome
// POST /api/v1/interviews/sessions/[sid]/message -> candidate msg -> adaptive AI reply
// POST /api/v1/interviews/sessions/[sid]/complete -> structured evaluation
//
// The candidate is inferred from the signed-in account + their application.
// Client-supplied candidate ids are ignored to prevent impersonation.
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rl = await checkRateLimit(rateLimitKey(req, `interview:start:${params.id}`), 20, 60_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many attempts. Slow down.", 429);

    const session = await getSession();
    if (!session) return errorResponse("UNAUTHORIZED", "Sign in as a candidate to start this interview.", 401);

    const { consent } = z
      .object({ consent: z.boolean().default(false) })
      .parse(await req.json().catch(() => ({})));
    if (!consent) {
      return errorResponse("VALIDATION_ERROR", "Consent is required before starting an AI interview.", 400);
    }

    const interview = await prisma.interview.findUnique({
      where: { id: params.id },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!interview) return errorResponse("NOT_FOUND", "Interview could not be found.", 404);
    if (interview.status !== "published") {
      return errorResponse("NOT_FOUND", "Interview is not open.", 404);
    }

    const candidate = await prisma.candidate.findFirst({
      where: {
        organizationId: interview.organizationId,
        deletedAt: null,
        OR: [{ userId: session.sub }, { email: session.email.toLowerCase() }],
      },
      orderBy: { createdAt: "asc" },
    });
    if (!candidate) {
      return errorResponse("FORBIDDEN", "Apply to this role first, then start the interview from your candidate portal.", 403);
    }

    const application = interview.jobId
      ? await prisma.application.findFirst({
          where: { candidateId: candidate.id, jobId: interview.jobId },
          orderBy: { createdAt: "asc" },
        })
      : await prisma.application.findFirst({
          where: { candidateId: candidate.id, organizationId: interview.organizationId },
          orderBy: { createdAt: "asc" },
        });
    if (interview.jobId && !application) {
      return errorResponse("FORBIDDEN", "You do not have an application for this interview.", 403);
    }

    const existing = await prisma.interviewSession.findFirst({
      where: { interviewId: interview.id, candidateId: candidate.id, status: "in_progress" },
      orderBy: { startedAt: "desc" },
    });
    if (existing) {
      return successResponse({ sessionId: existing.id, welcome: interview.questions[0]?.prompt ?? "Tell me about yourself.", resumed: true });
    }

    const created = await prisma.interviewSession.create({
      data: {
        interviewId: interview.id,
        candidateId: candidate.id,
        applicationId: application?.id,
        status: "in_progress",
        consentAt: new Date(),
        startedAt: new Date(),
      },
    });
    const firstQ = interview.questions[0]?.prompt ?? "Tell me about yourself and your relevant experience.";
    await prisma.interviewTranscript.createMany({
      data: [
        { sessionId: created.id, speaker: "system", message: "Interview started. Consent recorded." },
        { sessionId: created.id, speaker: "ai", message: `Welcome! I'm your AI interviewer for "${interview.title}". Let's begin.\n\n${firstQ}` },
      ],
    });
    await prisma.consentRecord
      .create({
        data: { candidateId: candidate.id, type: "ai_interview", version: "v1", granted: true },
      })
      .catch(() => undefined);

    return successResponse({ sessionId: created.id, welcome: firstQ, resumed: false }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
