import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const lists = await prisma.talentList.findMany({
    where: { organizationId: orgId },
    include: { members: { include: {} }, _count: { select: { members: true } } },
    orderBy: { createdAt: "desc" },
  });
  return successResponse(lists);
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
