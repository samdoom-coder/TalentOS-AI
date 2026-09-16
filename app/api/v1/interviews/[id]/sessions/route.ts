import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { runAi } from "@/lib/ai/service";
import { criterionEvaluationSchema } from "@/lib/ai/types";

// Session lifecycle for AI text/voice interviews.
// POST /api/v1/interviews/[id]/sessions -> create + welcome
// POST /api/v1/interviews/sessions/[sid]/message -> candidate msg -> adaptive AI reply
// POST /api/v1/interviews/sessions/[sid]/complete -> structured evaluation

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { candidateId, applicationId, consent } = z.object({
      candidateId: z.string().optional(),
      applicationId: z.string().optional(),
      consent: z.boolean().default(false),
    }).parse(await req.json().catch(() => ({})));
    const interview = await prisma.interview.findUnique({ where: { id: params.id }, include: { questions: { orderBy: { sortOrder: "asc" } } } });
    if (!interview) return errorResponse("NOT_FOUND", "Interview could not be found.", 404);

    const session = await prisma.interviewSession.create({
      data: { interviewId: interview.id, candidateId, applicationId, status: "in_progress", consentAt: consent ? new Date() : null, startedAt: new Date() },
    });
    const firstQ = interview.questions[0]?.prompt ?? "Tell me about yourself and your relevant experience.";
    await prisma.interviewTranscript.createMany({
      data: [
        { sessionId: session.id, speaker: "system", message: "Interview started. Consent recorded." },
        { sessionId: session.id, speaker: "ai", message: `Welcome! I'm your AI interviewer for "${interview.title}". Let's begin.\n\n${firstQ}` },
      ],
    });
    if (candidateId) {
      await prisma.consentRecord.create({ data: { candidateId, type: "ai_interview", version: "v1", granted: consent } }).catch(() => undefined);
    }
    return successResponse({ sessionId: session.id, welcome: firstQ }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
