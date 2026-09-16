import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { J } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { moveStageSchema } from "@/lib/validations";
import { audit, notifyOrgMembers } from "@/lib/audit/audit";
import { emitEvent } from "@/lib/webhooks/webhooks";
import { z } from "zod";

// Move candidate through ATS stages (single + auditable; bulk via repeated calls).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = moveStageSchema.parse(await req.json());
    if (body.applicationId !== params.id) return errorResponse("VALIDATION_ERROR", "Application mismatch.", 400);
    const app = await prisma.application.findUnique({ where: { id: params.id }, include: { candidate: true, job: true } });
    if (!app) return errorResponse("NOT_FOUND", "Application could not be found.", 404);
    const { membership, session } = await requireOrgAccess(app.organizationId);
    if (!can(membership.role, "candidates:move")) return errorResponse("FORBIDDEN", "Cannot move candidates.", 403);

    const fromStage = app.stage;
    const terminal = body.toStage === "hired" ? "hired" : body.toStage === "rejected" ? "rejected" : "active";
    const updated = await prisma.application.update({
      where: { id: app.id },
      data: {
        stage: body.toStage,
        status: terminal,
        events: { create: { type: "stage_changed", message: `${fromStage} → ${body.toStage}`, actorId: session.sub, metadata: J({ fromStage, toStage: body.toStage }) } },
        stageHistory: { create: { fromStage, toStage: body.toStage, actorId: session.sub, note: body.note } },
      },
    });
    await prisma.candidateStageHistory.create({ data: { candidateId: app.candidateId, stage: body.toStage, actorId: session.sub, note: body.note } });
    await audit({ organizationId: app.organizationId, actorId: session.sub, action: "candidate.moved", resource: "application", resourceId: app.id, metadata: { fromStage, toStage: body.toStage } });
    await notifyOrgMembers(app.organizationId, { type: "stage_changed", title: `${app.candidate.name} → ${body.toStage}`, body: app.job.title, link: `/candidates/${app.candidateId}`, excludeUserId: session.sub });
    await emitEvent(app.organizationId, "application.stage_changed", { applicationId: app.id, fromStage, toStage: body.toStage });

    return successResponse(updated);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    const code = status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : status === 404 ? "NOT_FOUND" : "INTERNAL_ERROR";
    return errorResponse(code as "UNAUTHORIZED", e instanceof Error ? e.message : "Move failed.", status);
  }
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const app = await prisma.application.findUnique({
    where: { id: params.id },
    include: {
      candidate: { include: { skills: true, experience: true, education: true, documents: true, scores: true, evidence: true } },
      job: { include: { requirements: true } },
      events: { orderBy: { createdAt: "desc" }, take: 50 },
      stageHistory: { orderBy: { createdAt: "desc" } },
      feedback: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!app) return errorResponse("NOT_FOUND", "Application could not be found.", 404);
  try {
    await requireOrgAccess(app.organizationId);
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return errorResponse(status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", "Not authorized.", status);
  }
  await audit({ organizationId: app.organizationId, action: "candidate.viewed", resource: "application", resourceId: app.id });
  return successResponse(app);
}
