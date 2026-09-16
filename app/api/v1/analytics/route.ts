import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";

// Recruiter + job + AI-usage analytics.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const jobId = req.nextUrl.searchParams.get("jobId") ?? undefined;
  const appWhere = { organizationId: orgId, ...(jobId ? { jobId } : {}) };

  const [
    totalApplications,
    byStage,
    hired,
    jobs,
    assessmentsCompleted,
    interviewsCompleted,
    aiRuns,
    aiUsage,
  ] = await Promise.all([
    prisma.application.count({ where: appWhere }),
    prisma.application.groupBy({ by: ["stage"], where: appWhere, _count: true }),
    prisma.application.count({ where: { ...appWhere, status: "hired" } }),
    prisma.job.findMany({
      where: { organizationId: orgId as string, deletedAt: null },
      select: { id: true, title: true, status: true, createdAt: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.assessmentAttempt.count({ where: { status: "evaluated", assessment: { organizationId: orgId as string } } }),
    prisma.interviewSession.count({ where: { status: "evaluated", interview: { organizationId: orgId as string } } }),
    prisma.aiRun.groupBy({ by: ["status"], where: { organizationId: orgId as string }, _count: true }),
    prisma.aiModelUsage.findMany({ where: { organizationId: orgId as string }, orderBy: { day: "desc" }, take: 14 }),
  ]);

  // Time-to-hire: avg days from application creation to hired for hired apps
  const hiredApps = await prisma.application.findMany({ where: { ...appWhere, status: "hired" }, select: { createdAt: true, updatedAt: true }, take: 200 });
  const avgDays = hiredApps.length
    ? Math.round((hiredApps.reduce((a, h) => a + (h.updatedAt.getTime() - h.createdAt.getTime()), 0) / hiredApps.length / 86400000) * 10) / 10
    : null;

  const totalTokens = aiUsage.reduce((a, u) => a + u.tokensIn + u.tokensOut, 0);
  const totalCost = Math.round(aiUsage.reduce((a, u) => a + u.costUsd, 0) * 10000) / 10000;

  return successResponse({
    funnel: { applications: totalApplications, byStage, hired, assessmentsCompleted, interviewsCompleted },
    conversion: totalApplications ? Math.round((hired / totalApplications) * 1000) / 10 : 0,
    timeToHireDays: avgDays,
    jobs,
    ai: { runs: aiRuns, usage: aiUsage, totalTokens, estimatedCostUsd: totalCost },
  });
}
