import { prisma } from "@/lib/db/prisma";

export interface SessionUser {
  sub: string;
  email: string;
  name: string;
}

/**
 * Ensure a signed-in user has a candidate profile.
 *
 * Candidate records are org-scoped because recruiters see candidates inside
 * their workspace. A user may also have one global profile (organizationId
 * null) that holds their self-managed data. Verified emails can additionally
 * claim pre-existing org candidate rows with the same address.
 */
export async function ensureCandidateProfile(user: SessionUser) {
  const email = user.email.toLowerCase().trim();
  let profile = await prisma.candidate.findFirst({
    where: { userId: user.sub, organizationId: null },
  });

  if (!profile) {
    const existing = await prisma.candidate.findFirst({
      where: { organizationId: null, email, userId: null },
      orderBy: { createdAt: "asc" },
    });
    profile = existing
      ? await prisma.candidate.update({
          where: { id: existing.id },
          data: { userId: user.sub, name: user.name },
        })
      : await prisma.candidate.create({
          data: { organizationId: null, userId: user.sub, name: user.name, email },
        });
  }

  // Never claim another person's org candidate rows until the email is verified.
  const dbUser = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { emailVerified: true },
  });
  if (dbUser?.emailVerified) {
    await prisma.candidate.updateMany({
      where: { email, userId: null },
      data: { userId: user.sub },
    });
  }

  return profile;
}

/** Link a candidate record to a user after they apply while signed in. */
export async function linkCandidateToUser(candidateId: string, userId: string) {
  await prisma.candidate.updateMany({
    where: { id: candidateId, OR: [{ userId: null }, { userId }] },
    data: { userId },
  });
}

/**
 * Candidate ids belonging to a user. Used by candidate-scoped APIs and by the
 * assessment/interview start routes to avoid trusting client-supplied ids.
 */
export async function candidateIdsForUser(userId: string) {
  const rows = await prisma.candidate.findMany({
    where: { userId, deletedAt: null },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

export async function findCandidateForUser(userId: string, organizationId?: string) {
  return prisma.candidate.findFirst({
    where: {
      userId,
      deletedAt: null,
      ...(organizationId ? { organizationId } : {}),
    },
    orderBy: { createdAt: "asc" },
  });
}
