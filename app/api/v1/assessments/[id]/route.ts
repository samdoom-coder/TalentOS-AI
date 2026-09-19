import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { J, P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { getSession, requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const a = await prisma.assessment.findUnique({
    where: { id: params.id },
    include: { sections: { include: { questions: true }, orderBy: { sortOrder: "asc" } }, attempts: { orderBy: { startedAt: "desc" }, take: 20, include: { result: true } } },
  });
  if (!a) return errorResponse("NOT_FOUND", "Assessment could not be found.", 404);
  // Recruiters (org members) get full detail incl. answer keys; anyone else
  // (candidates, anonymous) gets questions without answer keys.
  const session = await getSession();
  let isRecruiter = false;
  if (session && a.organizationId) {
    try {
      const { membership } = await requireOrgAccess(a.organizationId);
      isRecruiter = can(membership.role, "assessments:manage") || can(membership.role, "candidates:view");
    } catch {
      isRecruiter = false;
    }
  }
  if (isRecruiter) return successResponse(a);
  const stripped = {
    ...a,
    sections: a.sections.map((s) => ({
      ...s,
      questions: s.questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, options: q.options, points: q.points, sortOrder: q.sortOrder })),
    })),
  };
  return successResponse(stripped);
}

// Start an attempt (candidate flow; allows anonymous via candidateId/applicationId)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rl = checkRateLimit(rateLimitKey(req, `assess:${params.id}`), 20, 60_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many attempts. Slow down.", 429);
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "attempt";
    if (action === "attempt") {
      const { candidateId, applicationId } = z.object({ candidateId: z.string().optional(), applicationId: z.string().optional() }).parse(await req.json().catch(() => ({})));
      const assessment = await prisma.assessment.findUnique({ where: { id: params.id } });
      if (!assessment) return errorResponse("NOT_FOUND", "Assessment could not be found.", 404);
      const attempt = await prisma.assessmentAttempt.create({ data: { assessmentId: params.id, candidateId, applicationId, status: "started" } });
      const full = await prisma.assessment.findUnique({
        where: { id: params.id },
        include: { sections: { include: { questions: { select: { id: true, type: true, prompt: true, options: true, points: true, sortOrder: true } } }, orderBy: { sortOrder: "asc" } } },
      });
      // Strip answer keys for candidates
      return successResponse({ attemptId: attempt.id, assessment: full }, 201);
    }
    if (action === "submit") {
      const { attemptId, answers } = z.object({ attemptId: z.string(), answers: z.array(z.object({ questionId: z.string(), answer: z.unknown() })) }).parse(await req.json());
      const attempt = await prisma.assessmentAttempt.findUnique({ where: { id: attemptId }, include: { assessment: { include: { sections: { include: { questions: true } } } } } });
      if (!attempt) return errorResponse("NOT_FOUND", "Attempt not found.", 404);
      const keyById = new Map(attempt.assessment.sections.flatMap((s) => s.questions).map((q) => [q.id, q]));
      let earned = 0;
      let possible = 0;
      const breakdown: unknown[] = [];
      for (const a of answers) {
        const q = keyById.get(a.questionId);
        if (!q) continue;
        possible += q.points;
        let correct: boolean | null = null;
        let pts = 0;
        if (["mcq", "true_false"].includes(q.type) && q.answerKey) {
          const key = P<{ value?: unknown }>(q.answerKey, {}).value ?? P<unknown>(q.answerKey, null);
          correct = JSON.stringify(key) === JSON.stringify(a.answer);
          pts = correct ? q.points : 0;
        } else if (q.type === "multi_select" && q.answerKey) {
          const key = P<{ values?: unknown[] }>(q.answerKey, {}).values ?? [];
          const given = Array.isArray(a.answer) ? [...a.answer].sort() : [];
          correct = JSON.stringify([...key].sort()) === JSON.stringify(given);
          pts = correct ? q.points : 0;
        }
        earned += pts;
        breakdown.push({ questionId: q.id, type: q.type, correct, points: pts, of: q.points });
        await prisma.assessmentAnswer.create({ data: { attemptId, questionId: q.id, answer: J(a.answer), isCorrect: correct, points: pts } });
      }
      const score = possible ? Math.round((earned / possible) * 1000) / 10 : 0;
      const passed = attempt.assessment.passingScore !== null && attempt.assessment.passingScore !== undefined ? score >= attempt.assessment.passingScore : null;
      await prisma.assessmentAttempt.update({ where: { id: attemptId }, data: { status: "evaluated", score, passed: passed ?? undefined, submittedAt: new Date() } });
      await prisma.assessmentResult.create({ data: { attemptId, score, breakdown: J(breakdown), feedback: "Auto-graded. Free-text answers need manual review." } });
      return successResponse({ score, passed, earned, possible });
    }
    return errorResponse("NOT_FOUND", "Unknown action.", 404);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
