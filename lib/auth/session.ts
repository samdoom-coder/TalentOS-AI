import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE, type SessionPayload } from "./jwt";
import { prisma } from "@/lib/db/prisma";
import { can, type Permission } from "./rbac";

export interface RequestContext {
  user: { id: string; email: string; name: string } & Partial<SessionPayload>;
  membership?: { organizationId: string; role: string };
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const s = await getSession();
  if (!s) {
    const err = new Error("Unauthorized");
    (err as Error & { status?: number }).status = 401;
    throw err;
  }
  return s;
}

/** Load the user's membership for an org (multi-tenant authorization). */
export async function getMembership(userId: string, organizationId: string) {
  return prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId, userId } },
  });
}

/** Ensure the session user belongs to the org; returns membership. */
export async function requireOrgAccess(organizationId: string) {
  const session = await requireSession();
  if (!organizationId) {
    const err = new Error("Forbidden: organization is required");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  const membership = await getMembership(session.sub, organizationId);
  if (!membership) {
    const err = new Error("Forbidden: not a member of this organization");
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return { session, membership };
}

/**
 * Combined org-membership + RBAC check. Use in every mutating org route
 * instead of calling requireOrgAccess() alone (which allows any role).
 */
export async function requireOrgPermission(organizationId: string, permission: Permission) {
  const { session, membership } = await requireOrgAccess(organizationId);
  if (!can(membership.role, permission)) {
    const err = new Error(`Forbidden: missing permission ${permission}`);
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
  return { session, membership };
}
