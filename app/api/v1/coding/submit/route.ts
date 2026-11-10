import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { gradeSubmission } from "@/lib/coding/sandbox";
import { getSession } from "@/lib/auth/session";
import { candidateIdsForUser } from "@/lib/candidates/identity";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

const LANGUAGE_ALLOWLIST = new Set(["javascript", "typescript"]);

export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(rateLimitKey(req, "coding:submit"), 30, 60_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many submissions. Slow down.", 429);
    const { codingQuestionId, attemptId, code, language } = z.object({
      codingQuestionId: z.string().optional(),
      attemptId: z.string().optional(),
      code: z.string().min(1).max(50000),
      language: z.string().default("javascript"),
    }).parse(await req.json());
    if (!LANGUAGE_ALLOWLIST.has(language.toLowerCase())) {
      return errorResponse("VALIDATION_ERROR", "Only JavaScript/TypeScript run in the dev sandbox; other languages queue for Judge0 review.", 400);
    }
    // Real assessment submissions require an authenticated session (prevents
    // anonymous grading abuse + hidden-test probing). Practice runs without a
    // question id remain open but rate-limited above.
    let candidateId: string | undefined;
    if (codingQuestionId) {
      const session = await getSession();
      if (!session) return errorResponse("UNAUTHORIZED", "Sign in to submit.", 401);

      if (attemptId) {
        const attempt = await prisma.assessmentAttempt.findUnique({
          where: { id: attemptId },
          include: { assessment: { select: { timeLimitMin: true } } },
        });
        if (!attempt) return errorResponse("NOT_FOUND", "Attempt not found.", 404);
        if (attempt.status !== "started") {
          return errorResponse("CONFLICT", "This attempt has already been submitted.", 409);
        }
        if (attempt.assessment.timeLimitMin) {
          const deadline = attempt.startedAt.getTime() + attempt.assessment.timeLimitMin * 60_000 + 60_000;
          if (Date.now() > deadline) {
            await prisma.assessmentAttempt.update({ where: { id: attempt.id }, data: { status: "expired" } });
            return errorResponse("CONFLICT", "The time limit for this attempt has passed.", 409);
          }
        }
        // Never trust a client-supplied candidate id: the attempt is the
        // authority, and it must belong to the signed-in account.
        if (!attempt.candidateId) {
          return errorResponse("FORBIDDEN", "Not your attempt.", 403);
        }
        const owned = await candidateIdsForUser(session.sub);
        if (!owned.includes(attempt.candidateId)) {
          return errorResponse("FORBIDDEN", "Not your attempt.", 403);
        }
        candidateId = attempt.candidateId;
      } else {
        // Standalone coding questions still attribute the run to the
        // signed-in candidate when one exists.
        const ids = await candidateIdsForUser(session.sub);
        candidateId = ids[0];
      }
    }

    let publicTests: { name: string; input?: unknown; expected?: unknown }[] = [{ name: "smoke", expected: null }];
    let hiddenTests: { name: string; input?: unknown; expected?: unknown }[] = [];
    if (codingQuestionId) {
      const q = await prisma.codingQuestion.findUnique({ where: { id: codingQuestionId } });
      if (!q) return errorResponse("NOT_FOUND", "Coding question not found.", 404);
      publicTests = P<typeof publicTests>(q.publicTests, publicTests);
      hiddenTests = P<typeof hiddenTests>(q.hiddenTests, []);
    }

    const result = await gradeSubmission({ language, code, publicTests, hiddenTests });
    if (codingQuestionId) {
      const sub = await prisma.codingSubmission.create({
        data: {
          codingQuestionId, candidateId, attemptId, code, language,
          status: result.passed ? "passed" : "completed",
          passedCount: result.results.filter((r) => r.passed).length,
          totalCount: result.results.length,
        },
      });
      for (const r of result.results) {
        // Never reveal hidden test details to candidates in the response
        await prisma.codingTestResult.create({ data: { submissionId: sub.id, name: r.name, passed: r.passed, output: r.hidden ? undefined : r.output, hidden: r.hidden } });
      }
      const visible = result.results.filter((r) => !r.hidden);
      return successResponse({ passed: result.passed, results: visible, error: result.error });
    }
    return successResponse(result);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid submission.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Grading failed.", 500);
  }
}
