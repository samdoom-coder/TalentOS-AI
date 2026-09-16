import { prisma } from "@/lib/db/prisma";
import { Jo } from "@/lib/db/json";

export async function audit(input: {
  organizationId?: string;
  actorId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  metadata?: unknown;
  ip?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: input.actorId,
        action: input.action,
        resource: input.resource,
        resourceId: input.resourceId,
        metadata: Jo(input.metadata),
        ip: input.ip,
      },
    });
  } catch {
    // never break requests on audit failure
  }
}

export async function notify(input: {
  organizationId?: string;
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
}) {
  return prisma.notification.create({ data: input });
}

export async function notifyOrgMembers(
  organizationId: string,
  input: { type: string; title: string; body?: string; link?: string; excludeUserId?: string }
) {
  const members = await prisma.organizationMember.findMany({
    where: { organizationId, role: { in: ["owner", "admin", "recruiter"] } },
    select: { userId: true },
  });
  const targets = members.map((m) => m.userId).filter((id) => id !== input.excludeUserId);
  if (!targets.length) return;
  await prisma.notification.createMany({
    data: targets.map((userId) => ({
      organizationId,
      userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
    })),
  });
}
