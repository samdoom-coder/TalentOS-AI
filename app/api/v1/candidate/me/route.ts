import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse, candidateFacingStage } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";
import {
  ensureCandidateProfile,
  candidateIdsForUser,
} from "@/lib/candidates/identity";

function requireCandidate(role: string | undefined) {
  if (role !== "candidate") {
    const err = Object.assign(new Error("Candidate account required."), { status: 403 });
    throw err;
  }
}

async function loadPortal(userId: string, email: string, name: string) {
  const base = await ensureCandidateProfile({ sub: userId, email, name });
  const [profile, candidateIds] = await Promise.all([
    prisma.candidate.findUnique({
      where: { id: base.id },
      include: {
        skills: true,
        experience: { orderBy: { startDate: "desc" } },
        education: true,
        documents: { orderBy: { createdAt: "desc" } },
      },
    }),
    candidateIdsForUser(userId),
  ]);

  const applications = await prisma.application.findMany({
    where: { candidateId: { in: candidateIds } },
    include: {
      job: {
        select: {
          id: true,
          title: true,
          department: true,
          location: true,
          workMode: true,
          employmentType: true,
          status: true,
        },
      },
      organization: { select: { id: true, name: true, slug: true, logoUrl: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const jobIds = [...new Set(applications.map((a) => a.jobId))];

  const [assessments, interviews] = await Promise.all([
    prisma.assessment.findMany({
      where: {
        status: "published",
        OR: [
          ...(jobIds.length ? [{ jobId: { in: jobIds } }] : []),
          { attempts: { some: { candidateId: { in: candidateIds } } } },
        ],
      },
      include: {
        job: { select: { id: true, title: true } },
        attempts: {
          where: { candidateId: { in: candidateIds } },
          orderBy: { startedAt: "desc" },
          include: { result: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.interview.findMany({
      where: { status: "published", ...(jobIds.length ? { jobId: { in: jobIds } } : { id: { in: [] } }) },
      include: {
        job: { select: { id: true, title: true } },
        sessions: {
          where: { candidateId: { in: candidateIds } },
          select: { id: true, status: true, startedAt: true, endedAt: true, consentAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const assessmentsSafe = assessments.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    timeLimitMin: a.timeLimitMin,
    passingScore: a.passingScore,
    maxAttempts: a.maxAttempts,
    job: a.job,
    attempts: a.attempts.map((t) => ({
      id: t.id,
      status: t.status,
      score: t.score,
      passed: t.passed,
      startedAt: t.startedAt,
      submittedAt: t.submittedAt,
      feedback: t.result?.feedback ?? null,
    })),
    attemptsUsed: a.attempts.length,
    canStart: a.attempts.length < Math.max(1, a.maxAttempts) && !a.attempts.some((t) => t.status === "started"),
  }));

  const interviewsSafe = interviews.map((i) => ({
    id: i.id,
    title: i.title,
    mode: i.mode,
    durationMin: i.durationMin,
    difficulty: i.difficulty,
    job: i.job,
    sessions: i.sessions,
  }));

  return {
    user: { id: userId, email, name },
    profile,
    applications: applications.map((a) => ({
      id: a.id,
      stage: a.stage,
      stageLabel: candidateFacingStage(a.stage),
      status: a.status,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
      job: a.job,
      organization: a.organization,
    })),
    assessments: assessmentsSafe,
    interviews: interviewsSafe,
    stats: {
      applications: applications.length,
      activeApplications: applications.filter((a) => a.status === "active").length,
      assessmentsToTake: assessmentsSafe.filter((a) => a.canStart).length,
      interviewsToTake: interviewsSafe.filter((i) => !i.sessions.some((s) => ["in_progress", "completed", "evaluated"].includes(s.status))).length,
    },
  };
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHORIZED", "Sign in to view your candidate portal.", 401);
    requireCandidate(session.role);
    return successResponse(await loadPortal(session.sub, session.email, session.name));
  } catch (e) {
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse(
      status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Failed to load portal.",
      status
    );
  }
}

const httpUrl = z
  .string()
  .max(500)
  .refine(
    (v) => v === "" || (/^https?:\/\//i.test(v) && z.string().url().safeParse(v).success),
    "Must be an http(s) URL."
  );

const patchSchema = z.object({
  title: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  summary: z.string().max(5000).optional(),
  experienceYrs: z.number().min(0).max(80).nullable().optional(),
  portfolioUrl: httpUrl.optional(),
  linkedinUrl: httpUrl.optional(),
  githubUrl: httpUrl.optional(),
  websiteUrl: httpUrl.optional(),
  availability: z.string().max(200).optional(),
  discoverable: z.boolean().optional(),
  visibility: z.enum(["public", "recruiter_only", "private"]).optional(),
  skills: z.union([z.array(z.string().max(80)).max(50), z.string().max(1000)]).optional(),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHORIZED", "Sign in to update your profile.", 401);
    requireCandidate(session.role);

    const body = patchSchema.parse(await req.json());
    const profile = await ensureCandidateProfile({ sub: session.sub, email: session.email, name: session.name });

    const data: Record<string, unknown> = {};
    for (const key of [
      "title",
      "location",
      "phone",
      "summary",
      "experienceYrs",
      "portfolioUrl",
      "linkedinUrl",
      "githubUrl",
      "websiteUrl",
      "availability",
      "discoverable",
      "visibility",
    ] as const) {
      if (body[key] !== undefined) data[key] = body[key] === "" ? null : body[key];
    }
    // Opting into discovery implies a public talent profile.
    if (body.discoverable === true && body.visibility === undefined) data.visibility = "public";
    if (body.discoverable === false && body.visibility === undefined) data.visibility = "recruiter_only";

    const skills =
      body.skills === undefined
        ? undefined
        : (Array.isArray(body.skills) ? body.skills : body.skills.split(","))
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 50);

    await prisma.$transaction(async (tx) => {
      await tx.candidate.update({ where: { id: profile.id }, data });
      if (skills) {
        await tx.candidateSkill.deleteMany({ where: { candidateId: profile.id } });
        if (skills.length) {
          await tx.candidateSkill.createMany({
            data: skills.map((skill) => ({ candidateId: profile.id, skill })),
          });
        }
      }
    });

    const updated = await prisma.candidate.findUnique({
      where: { id: profile.id },
      include: { skills: true, experience: true, education: true, documents: true },
    });
    return successResponse(updated);
  } catch (e) {
    if (e instanceof z.ZodError) {
      return errorResponse("VALIDATION_ERROR", "Please check the profile fields.", 400, e.flatten());
    }
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse(
      status === 403 ? "FORBIDDEN" : "INTERNAL_ERROR",
      e instanceof Error ? e.message : "Failed to save profile.",
      status
    );
  }
}
