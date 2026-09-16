import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { runAi } from "@/lib/ai/service";
import { criterionEvaluationSchema } from "@/lib/ai/types";

export async function POST(_req: NextRequest, { params }: { params: { sid: string } }) {
  try {
    const session = await prisma.interviewSession.findUnique({
      where: { id: params.sid },
      include: { interview: true, transcripts: { orderBy: { createdAt: "asc" } } },
    });
    if (!session) return errorResponse("NOT_FOUND", "Session not found.", 404);

    const transcript = session.transcripts.map((t) => `${t.speaker.toUpperCase()}: ${t.message}`).join("\n");
    const criteria = P<string[]>(session.interview.criteria, ["Technical Knowledge", "Communication", "Problem Solving"]).join(", ");

    let summary = "Interview completed. Transcript available for review.";
    let evals: { name: string; score: number; confidence: "low" | "medium" | "high"; evidence: string[] }[] = [];
    try {
      const r = await runAi({
        task: "candidate_summary",
        userPrompt: `Summarize this interview for role "${session.interview.title}". Structure: Overview, Strengths, Gaps, Follow-ups.\n\n${transcript.slice(0, 6000)}`,
        organizationId: session.interview.organizationId,
      });
      summary = r.text;
    } catch { /* keep default */ }
    try {
      const r = await runAi({
        task: "interview_evaluation",
        userPrompt: `Evaluate against criteria: ${criteria}.\n\nTranscript:\n${transcript.slice(0, 8000)}`,
        jsonSchema: criterionEvaluationSchema,
        organizationId: session.interview.organizationId,
        temperature: 0.2,
      });
      evals = criterionEvaluationSchema.parse(r.json).criteria;
    } catch {
      evals = [];
    }

    await prisma.interviewSession.update({ where: { id: session.id }, data: { status: "evaluated", endedAt: new Date(), summary } });
    for (const e of evals) {
      await prisma.interviewEvaluation.create({
        data: { sessionId: session.id, criterion: e.name, score: e.score, evidence: e.evidence.join(" "), confidence: e.confidence, reasoningSummary: e.evidence[0]?.slice(0, 300), model: "audited" },
      });
    }
    const avg = evals.length ? Math.round((evals.reduce((a, e) => a + e.score, 0) / evals.length) * 10) / 10 : null;
    if (avg !== null && session.candidateId) {
      await prisma.candidateScore.create({ data: { candidateId: session.candidateId, scope: "interview", score: avg, confidence: "medium", model: "audited" } });
    }
    return successResponse({ summary, evaluations: evals, average: avg });
  } catch (e) {
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}

export async function GET(_req: NextRequest, { params }: { params: { sid: string } }) {
  const session = await prisma.interviewSession.findUnique({
    where: { id: params.sid },
    include: { transcripts: { orderBy: { createdAt: "asc" } }, evaluations: true, interview: true },
  });
  if (!session) return errorResponse("NOT_FOUND", "Session not found.", 404);
  return successResponse(session);
}
