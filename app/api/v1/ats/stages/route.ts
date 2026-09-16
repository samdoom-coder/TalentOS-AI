import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { audit } from "@/lib/audit/audit";

// ATS stage configuration: create/rename/reorder/custom stages per org.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const stages = await prisma.atsStage.findMany({ where: { organizationId: orgId }, orderBy: { sortOrder: "asc" } });
  return successResponse(stages);
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      organizationId: z.string(),
      name: z.string().min(2),
      candidateFacing: z.string().optional(),
      sortOrder: z.number().optional(),
    }).parse(await req.json());
    const { session } = await requireOrgAccess(body.organizationId);
    const count = await prisma.atsStage.count({ where: { organizationId: body.organizationId } });
    const stage = await prisma.atsStage.create({
      data: {
        organizationId: body.organizationId,
        name: body.name,
        slug: body.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40),
        candidateFacing: body.candidateFacing,
        sortOrder: body.sortOrder ?? count,
      },
    });
    await audit({ organizationId: body.organizationId, actorId: session.sub, action: "ats.stage_created", resource: "ats_stage", resourceId: stage.id });
    return successResponse(stage, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid stage.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
