import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { getSession, requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/audit";

// GDPR-style self-service: export own data (candidate by email) or delete account.
// Recruiter path: export/delete a candidate within their org (candidates:move perm).
export async function GET(req: NextRequest) {
  const email = req.nextUrl.searchParams.get("email")?.toLowerCase().trim();
  const orgId = req.nextUrl.searchParams.get("orgId");
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
  // Own export: any signed-in user exports candidates matching their email.
  if (email && email === session.email.toLowerCase() && !orgId) {
    const cands = await prisma.candidate.findMany({
      where: { email },
      include: { skills: true, experience: true, education: true, documents: true, scores: true, evidence: true, applications: { include: { events: true, stageHistory: true, feedback: false } } },
    });
    return successResponse({ email, candidates: cands });
  }
  if (!orgId || !email) return errorResponse("VALIDATION_ERROR", "email (+ orgId for recruiter export) required.", 400);
  try {
    const { membership } = await requireOrgAccess(orgId);
    if (!can(membership.role, "candidates:move")) return errorResponse("FORBIDDEN", "No access.", 403);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const cand = await prisma.candidate.findFirst({
    where: { organizationId: orgId, email },
    include: { skills: true, experience: true, education: true, documents: true, scores: true, evidence: true, applications: true },
  });
  if (!cand) return errorResponse("NOT_FOUND", "Candidate not found.", 404);
  return successResponse(cand);
}

export async function DELETE(req: NextRequest) {
  try {
    const body = z.object({ email: z.string().email().optional(), candidateId: z.string().optional(), organizationId: z.string().optional(), confirm: z.literal("DELETE") }).parse(await req.json());
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
    // Self delete: soft-delete user + candidates matching email.
    if (!body.candidateId) {
      const email = (body.email ?? session.email).toLowerCase().trim();
      if (email !== session.email.toLowerCase()) return errorResponse("FORBIDDEN", "Can only delete your own data.", 403);
      await prisma.candidate.updateMany({ where: { email }, data: { deletedAt: new Date() } });
      await prisma.user.update({ where: { id: session.sub }, data: { deletedAt: new Date() } });
      await audit({ actorId: session.sub, action: "privacy.self_delete", resource: "user", resourceId: session.sub });
      return successResponse({ ok: true });
    }
    // Recruiter delete within org (soft delete).
    if (!body.organizationId || !body.candidateId) return errorResponse("VALIDATION_ERROR", "organizationId + candidateId required.", 400);
    const { membership, session: s } = await requireOrgAccess(body.organizationId);
    if (!can(membership.role, "candidates:move")) return errorResponse("FORBIDDEN", "No access.", 403);
    const cand = await prisma.candidate.findUnique({ where: { id: body.candidateId } });
    if (!cand || cand.organizationId !== body.organizationId) return errorResponse("NOT_FOUND", "Candidate not found.", 404);
    await prisma.candidate.update({ where: { id: cand.id }, data: { deletedAt: new Date() } });
    await audit({ organizationId: body.organizationId, actorId: s.sub, action: "candidate.deleted", resource: "candidate", resourceId: cand.id });
    return successResponse({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
