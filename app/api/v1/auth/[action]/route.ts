import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";
import { loginSchema, signupSchema } from "@/lib/validations";
import { errorResponse, successResponse, uniqueSlug } from "@/lib/utils";
import { audit } from "@/lib/audit/audit";
import { cookies } from "next/headers";

const DEFAULT_STAGES = [
  { name: "Applied", slug: "applied", candidateFacing: "Application Received" },
  { name: "Screening", slug: "screening", candidateFacing: "Under Review" },
  { name: "Assessment", slug: "assessment", candidateFacing: "Assessment" },
  { name: "Interview", slug: "interview", candidateFacing: "Interview" },
  { name: "Technical Interview", slug: "technical_interview", candidateFacing: "Interview" },
  { name: "Final Interview", slug: "final_interview", candidateFacing: "Interview" },
  { name: "Offer", slug: "offer", candidateFacing: "Decision" },
  { name: "Hired", slug: "hired", candidateFacing: "Decision" },
  { name: "Rejected", slug: "rejected", candidateFacing: "Decision" },
];

async function setSessionCookie(payload: { sub: string; email: string; name: string; orgId?: string; role?: string }) {
  const token = await signSession(payload);
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function POST(req: NextRequest, { params }: { params: { action: string } }) {
  const { action } = params;
  try {
    if (action === "signup") {
      const body = signupSchema.parse(await req.json());
      const existing = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
      if (existing) return errorResponse("CONFLICT", "An account with this email already exists.", 409);

      const user = await prisma.user.create({
        data: {
          email: body.email.toLowerCase(),
          name: body.name,
          passwordHash: await hashPassword(body.password),
          emailVerified: true, // dev: auto-verify; production sends verification email
          role: body.role,
        },
      });

      let orgId: string | undefined;
      let role = body.role === "candidate" ? "candidate" : "owner";
      if (body.role === "recruiter") {
        const orgName = body.organizationName ?? `${body.name}'s Organization`;
        const org = await prisma.organization.create({
          data: {
            name: orgName,
            slug: uniqueSlug(orgName),
            members: { create: { userId: user.id, role: "owner" } },
            atsStages: { create: DEFAULT_STAGES.map((s, i) => ({ ...s, sortOrder: i, isDefault: true })) },
            subscriptions: { create: { plan: "free" } },
          },
        });
        orgId = org.id;
        await audit({ organizationId: org.id, actorId: user.id, action: "organization.created", resource: "organization", resourceId: org.id });
      }

      if (orgId) {
        await setSessionCookie({ sub: user.id, email: user.email, name: user.name, orgId, role });
      } else {
        await setSessionCookie({ sub: user.id, email: user.email, name: user.name, role });
      }
      await audit({ organizationId: orgId, actorId: user.id, action: "user.signup", resource: "user", resourceId: user.id });
      return successResponse({ id: user.id, email: user.email, name: user.name, orgId, role }, 201);
    }

    if (action === "login") {
      const body = loginSchema.parse(await req.json());
      const user = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() }, include: { memberships: true } });
      if (!user || !user.passwordHash) return errorResponse("UNAUTHORIZED", "Invalid email or password.", 401);
      const ok = await verifyPassword(body.password, user.passwordHash);
      if (!ok) return errorResponse("UNAUTHORIZED", "Invalid email or password.", 401);
      const membership = user.memberships[0];
      await setSessionCookie({
        sub: user.id, email: user.email, name: user.name,
        orgId: membership?.organizationId, role: membership?.role ?? user.role,
      });
      await audit({ organizationId: membership?.organizationId, actorId: user.id, action: "user.login", resource: "user", resourceId: user.id });
      return successResponse({ id: user.id, email: user.email, name: user.name, orgId: membership?.organizationId, role: membership?.role ?? user.role });
    }

    if (action === "logout") {
      cookies().delete(SESSION_COOKIE);
      return successResponse({ ok: true });
    }

    if (action === "forgot-password") {
      const { email } = z.object({ email: z.string().email() }).parse(await req.json());
      // Always succeed (no account enumeration); log token in dev.
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
      if (user) {
        const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
        await prisma.user.update({ where: { id: user.id }, data: { resetToken: token, resetExpires: new Date(Date.now() + 3600_000) } });
        console.log(`[auth] password reset for ${email}: token=${token}`);
      }
      return successResponse({ ok: true });
    }

    if (action === "reset-password") {
      const { token, password } = z.object({ token: z.string(), password: z.string().min(8) }).parse(await req.json());
      const user = await prisma.user.findFirst({ where: { resetToken: token, resetExpires: { gt: new Date() } } });
      if (!user) return errorResponse("NOT_FOUND", "Reset link is invalid or expired.", 400);
      await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password), resetToken: null, resetExpires: null } });
      return successResponse({ ok: true });
    }

    return errorResponse("NOT_FOUND", `Unknown auth action: ${action}`, 404);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse(status === 401 ? "UNAUTHORIZED" : status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR", e instanceof Error ? e.message : "Request failed.", status);
  }
}

export async function GET(req: NextRequest, { params }: { params: { action: string } }) {
  if (params.action === "me") {
    const token = cookies().get(SESSION_COOKIE)?.value;
    if (!token) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
    const session = await verifySession(token);
    if (!session) return errorResponse("UNAUTHORIZED", "Session expired.", 401);
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { memberships: { include: { organization: true } } },
    });
    if (!user) return errorResponse("UNAUTHORIZED", "Account not found.", 401);
    return successResponse({
      id: user.id, email: user.email, name: user.name,
      orgId: session.orgId ?? user.memberships[0]?.organizationId,
      role: session.role ?? user.memberships[0]?.role ?? user.role,
      organizations: user.memberships.map((m) => ({ id: m.organization.id, name: m.organization.name, slug: m.organization.slug, role: m.role })),
    });
  }
  return errorResponse("NOT_FOUND", "Unknown action.", 404);
}
