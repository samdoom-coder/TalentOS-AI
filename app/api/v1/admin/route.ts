import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";

// Platform admin: cross-org visibility. MVP: any org owner/admin can view
// aggregate health of orgs they belong to (full super-admin role is phase 5).
export async function GET(_req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
  const memberships = await prisma.organizationMember.findMany({ where: { userId: session.sub } });
  if (!memberships.some((m) => ["owner", "admin"].includes(m.role))) {
    return errorResponse("FORBIDDEN", "Admin access required.", 403);
  }
  const orgIds = memberships.map((m) => m.organizationId);
  const memberUserIds = (await prisma.organizationMember.findMany({ where: { organizationId: { in: orgIds } }, select: { userId: true } })).map((m) => m.userId);
  const [orgs, users, jobs, candidates, aiRuns, queueHealth] = await Promise.all([
    prisma.organization.count({ where: { id: { in: orgIds } } }),
    // Scoped: only users who share an org with the requester (no global enumeration).
    prisma.user.count({ where: { id: { in: memberUserIds } } }),
    prisma.job.count({ where: { organizationId: { in: orgIds } } }),
    prisma.candidate.count({ where: { organizationId: { in: orgIds } } }),
    prisma.aiRun.count({ where: { organizationId: { in: orgIds } } }),
    prisma.resume.groupBy({ by: ["status"], _count: true }),
  ]);
  return successResponse({ orgs, users, jobs, candidates, aiRuns, resumePipeline: queueHealth });
}
