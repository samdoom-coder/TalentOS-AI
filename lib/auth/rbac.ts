// Role-based access control. Single source of truth for permissions.
// Roles: owner > admin > recruiter > hiring_manager > interviewer > candidate

export type Role =
  | "owner"
  | "admin"
  | "recruiter"
  | "hiring_manager"
  | "interviewer"
  | "candidate";

export const ROLE_RANK: Record<Role, number> = {
  owner: 100,
  admin: 80,
  recruiter: 60,
  hiring_manager: 40,
  interviewer: 20,
  candidate: 10,
};

export const PERMISSIONS = {
  "org:manage": ["owner", "admin"],
  "org:members": ["owner", "admin"],
  "jobs:create": ["owner", "admin", "recruiter"],
  "jobs:edit": ["owner", "admin", "recruiter"],
  "jobs:view": ["owner", "admin", "recruiter", "hiring_manager", "interviewer"],
  "candidates:view": ["owner", "admin", "recruiter", "hiring_manager", "interviewer"],
  "candidates:move": ["owner", "admin", "recruiter"],
  "assessments:manage": ["owner", "admin", "recruiter"],
  "interviews:manage": ["owner", "admin", "recruiter"],
  "interviews:conduct": ["owner", "admin", "recruiter", "interviewer"],
  "feedback:submit": ["owner", "admin", "recruiter", "hiring_manager", "interviewer"],
  "messages:send": ["owner", "admin", "recruiter"],
  "analytics:view": ["owner", "admin", "recruiter", "hiring_manager"],
  "admin:view": ["owner", "admin"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function hasRole(userRole: string | undefined, allowed: readonly string[]): boolean {
  if (!userRole) return false;
  return (allowed as readonly string[]).includes(userRole);
}

export function can(userRole: string | undefined, permission: Permission): boolean {
  if (!userRole) return false;
  return hasRole(userRole, PERMISSIONS[permission]);
}

export function requireRole(userRole: string | undefined, permission: Permission): void {
  if (!can(userRole, permission)) {
    const err = new Error(`Forbidden: missing permission ${permission}`);
    (err as Error & { status?: number }).status = 403;
    throw err;
  }
}
