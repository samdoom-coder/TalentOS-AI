import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { signSession, SESSION_COOKIE, verifySession } from "@/lib/auth/jwt";
import { loginSchema, signupSchema } from "@/lib/validations";
import { errorResponse, successResponse, uniqueSlug } from "@/lib/utils";
import { audit } from "@/lib/audit/audit";
import { cookies } from "next/headers";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { generateSecureToken, hashToken, verifyTokenHash } from "@/lib/security/tokens";

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
      const rl = checkRateLimit(rateLimitKey(req, "auth:signup"), 10, 60_000);
      if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many signup attempts. Try again shortly.", 429);
      const body = signupSchema.parse(await req.json());
      const email = body.email.toLowerCase().trim();
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing) return errorResponse("CONFLICT", "An account with this email already exists.", 409);

      const user = await prisma.user.create({
        data: {
          email,
          name: body.name.trim(),
          passwordHash: await hashPassword(body.password),
          // Do NOT auto-verify: production must send a verification email.
          // Kept false here; existing dev seeds that set true keep working.
          emailVerified: false,
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
      const rl = checkRateLimit(rateLimitKey(req, "auth:login"), 10, 60_000);
      if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many login attempts. Try again shortly.", 429);
      const body = loginSchema.parse(await req.json());
      const email = body.email.toLowerCase().trim();
      const user = await prisma.user.findUnique({ where: { email }, include: { memberships: true } });
      if (!user || !user.passwordHash) return errorResponse("UNAUTHORIZED", "Invalid email or password.", 401);
      const ok = await verifyPassword(body.password, user.passwordHash);
      if (!ok) return errorResponse("UNAUTHORIZED", "Invalid email or password.", 401);
      // NOTE: JWT carries the *last-used* org for convenience only — every API
      // re-validates membership via requireOrgAccess(). Multi-org users switch
      // orgs via /orgs; never trust the token's orgId alone.
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
      const rl = checkRateLimit(rateLimitKey(req, "auth:forgot"), 5, 3600_000);
      if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many reset requests. Try again later.", 429);
      const { email } = z.object({ email: z.string().email() }).parse(await req.json());
      // Always succeed (no account enumeration); store only a hash, never the raw token.
      const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
      if (user) {
        const token = generateSecureToken(32);
        await prisma.user.update({
          where: { id: user.id },
          data: { resetToken: hashToken(token), resetExpires: new Date(Date.now() + 3600_000) },
        });
        // Dev only: surface token via server log. Production must email it.
        if (process.env.NODE_ENV !== "production") {
          console.log(`[auth] password reset requested for ${email} (token kept server-side, hash stored)`);
        }
        // TODO(prod): send reset email containing `token` (single display).
      }
      return successResponse({ ok: true });
    }

    if (action === "reset-password") {
      const rl = checkRateLimit(rateLimitKey(req, "auth:reset"), 10, 3600_000);
      if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many reset attempts. Try again later.", 429);
      const { token, password } = z.object({ token: z.string().min(16).max(256), password: z.string().min(8) }).parse(await req.json());
      const candidates = await prisma.user.findMany({ where: { resetExpires: { gt: new Date() } }, select: { id: true, resetToken: true } });
      // Compare against stored hashes in constant time; fall back once to legacy
      // plaintext tokens created before hashing (then immediately rotate).
      let matchedId: string | null = null;
      let legacy = false;
      for (const c of candidates) {
        if (!c.resetToken) continue;
        if (verifyTokenHash(token, c.resetToken)) {
          matchedId = c.id;
          break;
        }
        if (!legacy && c.resetToken === token) {
          matchedId = c.id;
          legacy = true;
        }
      }
      if (!matchedId) return errorResponse("NOT_FOUND", "Reset link is invalid or expired.", 400);
      await prisma.user.update({
        where: { id: matchedId },
        data: { passwordHash: await hashPassword(password), resetToken: null, resetExpires: null },
      });
      if (legacy) {
        await audit({ actorId: matchedId, action: "auth.reset_token_rotated_legacy", resource: "user", resourceId: matchedId });
      }
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
