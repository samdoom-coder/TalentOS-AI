import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/utils";
import { runAi } from "@/lib/ai/service";
import { requireOrgPermission } from "@/lib/auth/session";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

// AI question generation (draft only — recruiter must review/approve before publishing).
export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(rateLimitKey(req, "assess:generate"), 15, 60_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many generation requests.", 429);
    const { jobDescription, skills, level, type, difficulty, count, organizationId } = z.object({
      jobDescription: z.string().min(10),
      skills: z.array(z.string()).default([]),
      level: z.string().default("mid"),
      type: z.string().default("mcq"),
      difficulty: z.string().default("medium"),
      count: z.number().min(1).max(20).default(5),
      organizationId: z.string().min(1),
    }).parse(await req.json());
    await requireOrgPermission(organizationId, "assessments:manage");
    const result = await runAi({
      task: "question_generation",
      userPrompt: `Role context: ${jobDescription.slice(0, 2000)}\nSkills: ${skills.join(", ")}\nLevel: ${level}\nType: ${type}\nDifficulty: ${difficulty}\nCount: ${count}\n\nReturn a JSON array: [{type, prompt, options?, answerKey?, points}]. These are DRAFTS for human review.`,
      organizationId,
      temperature: 0.6,
    });
    return successResponse({ draft: result.text, provider: result.provider });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse(
      status === 403 ? "FORBIDDEN" : status === 401 ? "UNAUTHORIZED" : "AI_FAILED",
      e instanceof Error ? e.message : "Generation failed.",
      status
    );
  }
}
