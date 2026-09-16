import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { J } from "@/lib/db/json";
import { errorResponse, successResponse, getPagination } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { interviewSchema } from "@/lib/validations";
import { runAi } from "@/lib/ai/service";
import { criterionEvaluationSchema } from "@/lib/ai/types";
import { audit } from "@/lib/audit/audit";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get("orgId");
    if (!organizationId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
    await requireOrgAccess(organizationId);
    const { page, limit, skip, take } = getPagination(sp);
    const where = { organizationId };
    const [total, items] = await Promise.all([
      prisma.interview.count({ where }),
      prisma.interview.findMany({ where, include: { questions: true, sessions: { take: 5, orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" }, skip, take }),
    ]);
    return successResponse(items, 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const organizationId: string = body.organizationId;
    if (!organizationId) return errorResponse("VALIDATION_ERROR", "organizationId is required.", 400);
    const { membership, session } = await requireOrgAccess(organizationId);
    if (!can(membership.role, "interviews:manage")) return errorResponse("FORBIDDEN", "Cannot manage interviews.", 403);
    const input = interviewSchema.parse(body);

    // Pre-generate structured questions (recruiter can edit before assigning)
    let generated: string[] = [];
    try {
      const job = input.jobId ? await prisma.job.findUnique({ where: { id: input.jobId } }) : null;
      const r = await runAi({
        task: "interview_question_generation",
        userPrompt: `Interview: ${input.title}\nRole: ${job?.description?.slice(0, 1500) ?? "general"}\nTopics: ${input.topics.join(", ")}\nDifficulty: ${input.difficulty}\nCount: ${input.questionCount}\n\nReturn numbered questions, one per line.`,
        organizationId,
      });
      generated = r.text.split("\n").map((l) => l.replace(/^\d+[.)]\s*/, "").trim()).filter((l) => l.length > 5).slice(0, input.questionCount);
    } catch {
      generated = [];
    }

    const interview = await prisma.interview.create({
      data: {
        organizationId,
        jobId: input.jobId,
        title: input.title,
        mode: input.mode,
        durationMin: input.durationMin,
        difficulty: input.difficulty,
        topics: J(input.topics),
        questionCount: input.questionCount,
        criteria: J(input.criteria),
        status: "published",
        questions: { create: generated.map((prompt, i) => ({ prompt, sortOrder: i })) },
      },
      include: { questions: true },
    });
    await audit({ organizationId, actorId: session.sub, action: "interview.created", resource: "interview", resourceId: interview.id });
    return successResponse(interview, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid interview.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Create failed.", status);
  }
}
