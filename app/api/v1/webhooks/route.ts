import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { J } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { isBlockedWebhookUrl } from "@/lib/security/fetch";
import { randomUUID } from "crypto";

export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const hooks = await prisma.webhook.findMany({ where: { organizationId: orgId }, include: { deliveries: { take: 10, orderBy: { createdAt: "desc" } } } });
  return successResponse(hooks.map((h) => ({ ...h, secret: h.secret ? "•••set•••" : null })));
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({ organizationId: z.string(), url: z.string().url().max(2000), events: z.array(z.string()).default([]) }).parse(await req.json());
    const { membership } = await requireOrgAccess(body.organizationId);
    if (!can(membership.role, "org:manage")) return errorResponse("FORBIDDEN", "Only owners/admins can manage webhooks.", 403);
    if (isBlockedWebhookUrl(body.url)) {
      return errorResponse("VALIDATION_ERROR", "Webhook URL must be a public https URL (no localhost/internal).", 400);
    }
    const hook = await prisma.webhook.create({ data: { organizationId: body.organizationId, url: body.url, events: J(body.events), secret: randomUUID() } });
    return successResponse({ ...hook, secretNote: "Store the secret now — it is hashed on read in later versions." }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid webhook.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
