import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    const { membership } = await requireOrgAccess(orgId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const lists = await prisma.talentList.findMany({
    where: { organizationId: orgId },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
  // Enrich members with candidate basics (single extra query per list is fine for MVP sizes)
  const enriched = await Promise.all(
    lists.map(async (l: any) => {
      const members = await prisma.talentListMember.findMany({ where: { listId: l.id }, take: 50 });
      const cands = members.length
        ? await prisma.candidate.findMany({ where: { id: { in: members.map((m) => m.candidateId) } }, select: { id: true, name: true, email: true, title: true } })
        : [];
      const byId = new Map(cands.map((c) => [c.id, c]));
      return { ...l, members: members.map((m) => ({ ...m, candidate: byId.get(m.candidateId) ?? null })) };
    })
  );
  return successResponse(enriched);
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      organizationId: z.string(),
      name: z.string().min(2),
      description: z.string().optional(),
      candidateId: z.string().optional(),
      note: z.string().optional(),
    }).parse(await req.json());
    const { session } = await requireOrgAccess(body.organizationId);
    void session;
    const list = await prisma.talentList.create({ data: { organizationId: body.organizationId, name: body.name, description: body.description } });
    if (body.candidateId) {
      await prisma.talentListMember.create({ data: { listId: list.id, candidateId: body.candidateId, note: body.note } }).catch(() => undefined);
    }
    return successResponse(list, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
