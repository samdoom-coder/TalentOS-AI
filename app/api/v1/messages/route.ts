import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse, getPagination } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { sendEmail, MESSAGE_TEMPLATES, renderTemplate, validateTemplateVars } from "@/lib/email/email";
import { audit } from "@/lib/audit/audit";

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const organizationId = sp.get("orgId");
    if (!organizationId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
    await requireOrgAccess(organizationId);
    const { page, limit, skip, take } = getPagination(sp);
    const where = { organizationId };
    const [total, items] = await Promise.all([
      prisma.message.count({ where }),
      prisma.message.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    ]);
    return successResponse({ templates: MESSAGE_TEMPLATES, messages: items }, 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}

// Recruiter-approved send (AI drafts via /assessments/generate-style assist; approval enforced here by requiring explicit send).
export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      organizationId: z.string(),
      to: z.string().email(),
      subject: z.string().min(3),
      body: z.string().min(3),
      template: z.string().optional(),
      candidateId: z.string().optional(),
      applicationId: z.string().optional(),
      vars: z.record(z.string()).default({}),
    }).parse(await req.json());
    const { membership, session } = await requireOrgAccess(body.organizationId);
    if (!can(membership.role, "messages:send")) return errorResponse("FORBIDDEN", "Cannot send messages.", 403);
    const missing = validateTemplateVars(`${body.subject}\n${body.body}`, body.vars);
    if (missing.length) return errorResponse("VALIDATION_ERROR", `Missing template variables: ${missing.join(", ")}`, 400);
    const msg = await sendEmail({
      organizationId: body.organizationId,
      to: body.to,
      subject: renderTemplate(body.subject, body.vars),
      body: renderTemplate(body.body, body.vars),
      template: body.template,
      candidateId: body.candidateId,
      applicationId: body.applicationId,
    });
    await audit({ organizationId: body.organizationId, actorId: session.sub, action: "message.sent", resource: "message", resourceId: msg.id, metadata: { to: body.to, template: body.template } });
    return successResponse(msg, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid message.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Send failed.", status);
  }
}
