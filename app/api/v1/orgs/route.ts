import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";

// Org membership, ATS config, settings surface (owner/admin managed).
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    const { membership } = await requireOrgAccess(orgId);
    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        atsStages: { orderBy: { sortOrder: "asc" } },
        subscriptions: true,
      },
    });
    if (!org) return errorResponse("NOT_FOUND", "Organization not found.", 404);
    return successResponse({ ...org, myRole: membership.role });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 401;
    return errorResponse("UNAUTHORIZED", "Not authorized.", status);
  }
}
