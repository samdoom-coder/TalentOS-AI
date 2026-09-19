import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { J, P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/audit";

const KNOWN = ["google_calendar", "slack", "zoom", "teams", "job_board", "hris"] as const;

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const rows = await prisma.integration.findMany({ where: { organizationId: orgId }, orderBy: { type: "asc" } });
  const byType = new Map(rows.map((r) => [r.type, r]));
  // Always return known slots so UI can show Connect/Disconnect (not-yet-connected = disabled).
  const items = KNOWN.map((t) => byType.get(t) ?? { organizationId: orgId, type: t, enabled: false, config: null, _missing: true });
  return successResponse(items);
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      organizationId: z.string(),
      type: z.enum(KNOWN as unknown as [string, ...string[]]),
      enabled: z.boolean().default(true),
      config: z.record(z.string()).optional(),
    }).parse(await req.json());
    const { membership, session } = await requireOrgAccess(body.organizationId);
    if (!can(membership.role, "org:manage")) return errorResponse("FORBIDDEN", "Only owners/admins can manage integrations.", 403);
    const existing = await prisma.integration.findFirst({ where: { organizationId: body.organizationId, type: body.type } });
    const data = { enabled: body.enabled, config: body.config ? J(body.config) : undefined };
    const row = existing
      ? await prisma.integration.update({ where: { id: existing.id }, data })
      : await prisma.integration.create({ data: { organizationId: body.organizationId, type: body.type, enabled: body.enabled, config: body.config ? J(body.config) : null } });
    await audit({ organizationId: body.organizationId, actorId: session.sub, action: "integration.updated", resource: "integration", resourceId: row.id, metadata: { type: body.type, enabled: body.enabled } });
    return successResponse(row);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid integration.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
