import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { runAi } from "@/lib/ai/service";
import { getSession, getMembership } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

// AI-assisted job drafting. Recruiter edits everything before publishing.
export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(rateLimitKey(req, "jobs:generate"), 15, 60_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many generation requests.", 429);
    const { brief, organizationId } = z.object({ brief: z.string().min(10).max(2000), organizationId: z.string().optional() }).parse(await req.json());
    if (organizationId) {
      const session = await getSession();
      if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
      const membership = await getMembership(session.sub, organizationId).catch(() => null);
      if (!membership || !can(membership.role, "jobs:create")) {
        return errorResponse("FORBIDDEN", "Cannot generate job drafts.", 403);
      }
    }
    const result = await runAi({
      task: "job_generation",
      userPrompt: `Brief: ${brief}\n\nReturn markdown with sections: Description, Responsibilities, Required Skills, Preferred Skills, Interview Questions, Assessment Plan.`,
      organizationId,
      temperature: 0.5,
    });
    return successResponse({ draft: result.text, provider: result.provider, model: result.model });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Provide a brief of at least 10 characters.", 400, e.flatten());
    return errorResponse("AI_FAILED", e instanceof Error ? e.message : "Generation failed.", 500);
  }
}
