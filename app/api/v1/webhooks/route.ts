import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { J } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
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
    const body = z.object({ organizationId: z.string(), url: z.string().url(), events: z.array(z.string()).default([]) }).parse(await req.json());
    await requireOrgAccess(body.organizationId);
    const hook = await prisma.webhook.create({ data: { organizationId: body.organizationId, url: body.url, events: J(body.events), secret: randomUUID() } });
    return successResponse({ ...hook, secretNote: "Store the secret now — it is hashed on read in later versions." }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid webhook.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
