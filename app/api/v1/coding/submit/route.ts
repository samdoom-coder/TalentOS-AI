import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { gradeSubmission } from "@/lib/coding/sandbox";

export async function POST(req: NextRequest) {
  try {
    const { codingQuestionId, candidateId, attemptId, code, language } = z.object({
      codingQuestionId: z.string().optional(),
      candidateId: z.string().optional(),
      attemptId: z.string().optional(),
      code: z.string().min(1).max(50000),
      language: z.string().default("javascript"),
    }).parse(await req.json());

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
