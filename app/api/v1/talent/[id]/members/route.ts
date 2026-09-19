import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

// Talent list members: add / remove candidates (recruiter flow).
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = z.object({ candidateId: z.string(), note: z.string().max(500).optional() }).parse(await req.json());
    const list = await prisma.talentList.findUnique({ where: { id: params.id } });
    if (!list) return errorResponse("NOT_FOUND", "List not found.", 404);
    const { membership } = await requireOrgAccess(list.organizationId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);
    const cand = await prisma.candidate.findUnique({ where: { id: body.candidateId } });
    if (!cand || cand.organizationId !== list.organizationId) return errorResponse("VALIDATION_ERROR", "Candidate belongs to a different organization.", 400);
    const member = await prisma.talentListMember.upsert({
      where: { listId_candidateId: { listId: list.id, candidateId: body.candidateId } },
      update: { note: body.note },
      create: { listId: list.id, candidateId: body.candidateId, note: body.note },
    });
    return successResponse(member, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const candidateId = req.nextUrl.searchParams.get("candidateId");
  if (!candidateId) return errorResponse("VALIDATION_ERROR", "candidateId is required.", 400);
  const list = await prisma.talentList.findUnique({ where: { id: params.id } });
  if (!list) return errorResponse("NOT_FOUND", "List not found.", 404);
  try {
    const { membership } = await requireOrgAccess(list.organizationId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  await prisma.talentListMember.deleteMany({ where: { listId: list.id, candidateId } });
  return successResponse({ ok: true });
}
