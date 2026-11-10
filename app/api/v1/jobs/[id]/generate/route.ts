import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgPermission } from "@/lib/auth/session";
import { runAi } from "@/lib/ai/service";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

// Legacy path kept for compatibility. Prefer POST /api/v1/jobs/generate.
// Organization is mandatory: unauthenticated callers must never spend AI credits.
export async function POST(req: NextRequest) {
  try {
    const rl = checkRateLimit(rateLimitKey(req, "jobs:generate"), 15, 60_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many generation requests.", 429);

    const { brief, organizationId } = z
      .object({ brief: z.string().min(10).max(2000), organizationId: z.string().min(1) })
      .parse(await req.json());

    await requireOrgPermission(organizationId, "jobs:create");

    const result = await runAi({
      task: "job_generation",
      userPrompt: `Brief: ${brief}\n\nReturn markdown with sections: Description, Responsibilities, Required Skills, Preferred Skills, Interview Questions, Assessment Plan.`,
      organizationId,
      temperature: 0.5,
    });
    return successResponse({ draft: result.text, provider: result.provider, model: result.model });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse("VALIDATION_ERROR", "Provide a brief of at least 10 characters and an organization.", 400, e.flatten());
    }
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse(
      status === 403 ? "FORBIDDEN" : status === 401 ? "UNAUTHORIZED" : "AI_FAILED",
      e instanceof Error ? e.message : "Generation failed.",
      status
    );
  }
}
