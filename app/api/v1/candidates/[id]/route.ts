import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { audit } from "@/lib/audit/audit";

// Rich candidate profile: overview, resume, experience, skills, applications,
// assessments, interviews, role-plays, showcases, feedback, activity.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const candidate = await prisma.candidate.findUnique({
    where: { id: params.id },
    include: {
      skills: true,
      experience: true,
      education: true,
      documents: true,
      scores: { orderBy: { createdAt: "desc" } },
      evidence: true,
      stageHistory: { orderBy: { createdAt: "desc" } },
      consents: true,
      applications: {
        include: {
          job: { select: { id: true, title: true } },
          events: { orderBy: { createdAt: "desc" }, take: 30 },
          stageHistory: { orderBy: { createdAt: "desc" } },
          feedback: { orderBy: { createdAt: "desc" } },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!candidate || candidate.deletedAt) return errorResponse("NOT_FOUND", "Candidate could not be found.", 404);
  if (candidate.organizationId) {
    try {
      const { session } = await requireOrgAccess(candidate.organizationId);
      await audit({ organizationId: candidate.organizationId, actorId: session.sub, action: "candidate.viewed", resource: "candidate", resourceId: candidate.id });
    } catch (e) {
      const status = (e as Error & { status?: number }).status ?? 401;
      return errorResponse(status === 403 ? "FORBIDDEN" : "UNAUTHORIZED", "Not authorized.", status);
    }
  }
  // Never expose internal recruiter notes to candidate-role callers at the page layer;
  // API keeps feedback but candidate portal calls a separate scoped endpoint.
  return successResponse(candidate);
}
