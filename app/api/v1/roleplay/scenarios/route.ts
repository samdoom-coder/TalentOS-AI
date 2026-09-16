import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { J, P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { runAi } from "@/lib/ai/service";
import { criterionEvaluationSchema } from "@/lib/ai/types";

// Role-play engine: recruiter configures scenario+persona; AI plays counterpart;
// conversation is evaluated against objectives.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch (e) {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const items = await prisma.roleplayScenario.findMany({ where: { organizationId: orgId }, include: { sessions: { take: 5, orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } });
  return successResponse(items);
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      organizationId: z.string(),
      title: z.string().min(3),
      persona: z.string().min(3),
      scenario: z.string().min(10),
      difficulty: z.string().default("medium"),
      objectives: z.array(z.string()).default([]),
      criteria: z.array(z.string()).default(["Communication", "Empathy", "Problem Solving"]),
      durationMin: z.number().default(10),
      action: z.enum(["scenario", "start", "evaluate"]).default("scenario"),
      scenarioId: z.string().optional(),
      candidateId: z.string().optional(),
      applicationId: z.string().optional(),
    }).parse(await req.json());
    const { session } = await requireOrgAccess(body.organizationId);

    if (body.action === "scenario") {
      const s = await prisma.roleplayScenario.create({
        data: { organizationId: body.organizationId, title: body.title, persona: body.persona, scenario: body.scenario, difficulty: body.difficulty, objectives: J(body.objectives), criteria: J(body.criteria), durationMin: body.durationMin },
      });
      return successResponse(s, 201);
    }
    if (body.action === "start") {
      if (!body.scenarioId) return errorResponse("VALIDATION_ERROR", "scenarioId required.", 400);
      const sc = await prisma.roleplayScenario.findUnique({ where: { id: body.scenarioId } });
      if (!sc) return errorResponse("NOT_FOUND", "Scenario not found.", 404);
      const rs = await prisma.roleplaySession.create({ data: { scenarioId: sc.id, candidateId: body.candidateId, applicationId: body.applicationId, status: "in_progress", startedAt: new Date() } });
      const opener = `(${sc.persona}): ${sc.scenario.slice(0, 300)} — Go ahead, I'm listening.`;
      await prisma.roleplayMessage.create({ data: { sessionId: rs.id, speaker: "ai", message: opener } });
      return successResponse({ sessionId: rs.id, opener }, 201);
    }
    // evaluate
    if (!body.scenarioId) return errorResponse("VALIDATION_ERROR", "scenarioId (session id) required.", 400);
    const rs = await prisma.roleplaySession.findUnique({ where: { id: body.scenarioId }, include: { messages: { orderBy: { createdAt: "asc" } }, scenario: true } });
    if (!rs) return errorResponse("NOT_FOUND", "Session not found.", 404);
    const convo = rs.messages.map((m) => `${m.speaker}: ${m.message}`).join("\n");
    let evals: { name: string; score: number; confidence: "low" | "medium" | "high"; evidence: string[] }[] = [];
    try {
      const r = await runAi({
        task: "roleplay_evaluation",
        userPrompt: `Scenario: ${rs.scenario.title}\nObjectives: ${JSON.stringify(P<string[]>(rs.scenario.objectives, []))}\n\nConversation:\n${convo.slice(0, 6000)}`,
        jsonSchema: criterionEvaluationSchema,
        organizationId: body.organizationId,
        temperature: 0.2,
      });
      evals = criterionEvaluationSchema.parse(r.json).criteria;
      for (const e of evals) {
        await prisma.roleplayEvaluation.create({ data: { sessionId: rs.id, criterion: e.name, score: e.score, evidence: e.evidence.join(" ") } });
      }
    } catch { /* keep empty */ }
    await prisma.roleplaySession.update({ where: { id: rs.id }, data: { status: "evaluated", endedAt: new Date() } });
    return successResponse({ evaluations: evals });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
