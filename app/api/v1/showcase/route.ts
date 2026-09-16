import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { gradeSubmission } from "@/lib/coding/sandbox";

// Showcase (portfolio/project requests + sessions) and coding submissions share
// this "practical evaluation" surface; coding runs through the sandbox facade.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const items = await prisma.showcase.findMany({ where: { organizationId: orgId }, include: { sessions: { take: 10, orderBy: { createdAt: "desc" } } }, orderBy: { createdAt: "desc" } });
  return successResponse(items);
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      organizationId: z.string(),
      jobId: z.string().optional(),
      title: z.string().min(3),
      instructions: z.string().optional(),
      projectUrl: z.string().optional(),
      description: z.string().optional(),
      candidateId: z.string().optional(),
      applicationId: z.string().optional(),
    }).parse(await req.json());
    await requireOrgAccess(body.organizationId);
    const showcase = await prisma.showcase.create({ data: { organizationId: body.organizationId, jobId: body.jobId, title: body.title, instructions: body.instructions } });
    if (body.candidateId || body.projectUrl) {
      await prisma.showcaseSession.create({
        data: { showcaseId: showcase.id, candidateId: body.candidateId, applicationId: body.applicationId, projectUrl: body.projectUrl, description: body.description, status: "submitted" },
      });
    }
    return successResponse(showcase, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
