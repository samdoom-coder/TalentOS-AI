import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { J, P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";

// Saved searches: recruiter-persisted candidate filters.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    const { membership } = await requireOrgAccess(orgId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const items = await prisma.savedSearch.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" }, take: 50 });
  return successResponse(items.map((s) => ({ ...s, filters: P(s.filters, {}) })));
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({ organizationId: z.string(), name: z.string().min(2).max(80), filters: z.record(z.string()) }).parse(await req.json());
    const { membership, session } = await requireOrgAccess(body.organizationId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);
    const row = await prisma.savedSearch.create({
      data: { organizationId: body.organizationId, userId: session.sub, name: body.name, filters: J(body.filters) },
    });
    return successResponse(row, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid search.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
