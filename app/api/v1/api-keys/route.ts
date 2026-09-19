import { NextRequest } from "next/server";
import { z } from "zod";
import { createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { audit } from "@/lib/audit/audit";

// Org API keys: secret shown ONCE at creation, only hash stored.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    const { membership } = await requireOrgAccess(orgId);
    if (!can(membership.role, "org:manage")) return errorResponse("FORBIDDEN", "Only owners/admins.", 403);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const keys = await prisma.apiKey.findMany({ where: { organizationId: orgId }, orderBy: { createdAt: "desc" } });
  return successResponse(keys.map((k) => ({ id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes, lastUsedAt: k.lastUsedAt, revokedAt: k.revokedAt, createdAt: k.createdAt })));
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({ organizationId: z.string(), name: z.string().min(2).max(60), scopes: z.array(z.string()).default([]) }).parse(await req.json());
    const { membership, session } = await requireOrgAccess(body.organizationId);
    if (!can(membership.role, "org:manage")) return errorResponse("FORBIDDEN", "Only owners/admins.", 403);
    const secret = `tk_${randomBytes(24).toString("hex")}`;
    const keyHash = createHash("sha256").update(secret).digest("hex");
    const row = await prisma.apiKey.create({
      data: { organizationId: body.organizationId, userId: session.sub, name: body.name, keyHash, keyPrefix: secret.slice(0, 8), scopes: JSON.stringify(body.scopes) },
    });
    await audit({ organizationId: body.organizationId, actorId: session.sub, action: "apikey.created", resource: "api_key", resourceId: row.id });
    return successResponse({ id: row.id, secret, note: "Store now — never shown again." }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid key.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!id || !orgId) return errorResponse("VALIDATION_ERROR", "id + orgId required.", 400);
  try {
    const { membership, session } = await requireOrgAccess(orgId);
    if (!can(membership.role, "org:manage")) return errorResponse("FORBIDDEN", "Only owners/admins.", 403);
    await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
    await audit({ organizationId: orgId, actorId: session.sub, action: "apikey.revoked", resource: "api_key", resourceId: id });
    return successResponse({ ok: true });
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
}
