import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { audit } from "@/lib/audit/audit";

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
