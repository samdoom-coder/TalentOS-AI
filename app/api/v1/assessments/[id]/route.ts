import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { J, P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { getSession, requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { candidateIdsForUser } from "@/lib/candidates/identity";
import {
  signAssessmentAttempt,
  verifyAssessmentAttempt,
  verifyAssessmentInvite,
} from "@/lib/assessments/tokens";

const AUTO_GRADED = new Set(["mcq", "true_false", "multi_select"]);

async function isStaff(organizationId: string) {
  const session = await getSession();
  if (!session) return { session: null, staff: false };
  try {
    const { membership } = await requireOrgAccess(organizationId);
    const staff = can(membership.role, "assessments:manage") || can(membership.role, "candidates:view");
    return { session, staff };
  } catch {
    return { session, staff: false };
  }
}

/**
 * Resolve which candidate (and application) may access an assessment.
 * Access requires either a signed recruiter invite or an application to the
 * assessment's job. Client-supplied candidate ids are never trusted.
 */
async function resolveCandidateAccess(
  assessment: { id: string; organizationId: string; jobId: string | null },
  userId: string,
  userEmail: string,
  inviteToken?: string | null
) {
  if (inviteToken) {
    const invite = await verifyAssessmentInvite(inviteToken);
    if (
      !invite ||
      invite.assessmentId !== assessment.id ||
      invite.organizationId !== assessment.organizationId
    ) {
      return null;
    }
    const candidate = await prisma.candidate.findFirst({
      where: {
        id: invite.candidateId,
        deletedAt: null,
        OR: [
          { organizationId: assessment.organizationId },
          ...(assessment.jobId
            ? [{ applications: { some: { jobId: assessment.jobId } } }]
            : []),
        ],
        AND: [{ OR: [{ userId }, { userId: null, email: userEmail.toLowerCase() }] }],
      },
    });
    if (!candidate) return null;
    const application = invite.applicationId
      ? await prisma.application.findFirst({
          where: { id: invite.applicationId, candidateId: candidate.id },
        })
      : assessment.jobId
        ? await prisma.application.findFirst({
            where: { candidateId: candidate.id, jobId: assessment.jobId },
            orderBy: { createdAt: "asc" },
          })
        : null;
    return { candidateId: candidate.id, applicationId: application?.id, via: "invite" as const };
  }

  // Without an invite, only candidates who applied to the linked job qualify.
  if (!assessment.jobId) return null;
  const candidateIds = await candidateIdsForUser(userId);
  if (!candidateIds.length) return null;
  const application = await prisma.application.findFirst({
    where: { candidateId: { in: candidateIds }, jobId: assessment.jobId },
    orderBy: { createdAt: "asc" },
  });
  if (!application) return null;
  return { candidateId: application.candidateId, applicationId: application.id, via: "application" as const };
}

function safeAssessment(a: {
  id: string;
  title: string;
  description: string | null;
  timeLimitMin: number | null;
  passingScore: number | null;
  maxAttempts: number;
  status: string;
  jobId: string | null;
  sections: { id: string; title: string; sortOrder: number; questions: { id: string; type: string; prompt: string; options: string | null; points: number; sortOrder: number }[] }[];
}) {
  return {
    id: a.id,
    title: a.title,
    description: a.description,
    timeLimitMin: a.timeLimitMin,
    passingScore: a.passingScore,
    maxAttempts: a.maxAttempts,
    status: a.status,
    jobId: a.jobId,
    sections: a.sections.map((s) => ({
      id: s.id,
      title: s.title,
      sortOrder: s.sortOrder,
      questions: s.questions.map((q) => ({
        id: q.id,
        type: q.type,
        prompt: q.prompt,
        options: q.options,
        points: q.points,
        sortOrder: q.sortOrder,
      })),
    })),
  };
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHORIZED", "Sign in to view this assessment.", 401);

    const a = await prisma.assessment.findUnique({
      where: { id: params.id },
      include: {
        sections: { include: { questions: true }, orderBy: { sortOrder: "asc" } },
        attempts: { orderBy: { startedAt: "desc" }, take: 50, include: { result: true } },
      },
    });
    if (!a) return errorResponse("NOT_FOUND", "Assessment could not be found.", 404);

    const { staff } = await isStaff(a.organizationId);
    if (staff) return successResponse(a);

    if (a.status !== "published") {
      return errorResponse("NOT_FOUND", "Assessment could not be found.", 404);
    }
    const access = await resolveCandidateAccess(a, session.sub, session.email, req.nextUrl.searchParams.get("invite"));
    if (!access) {
      return errorResponse("FORBIDDEN", "You do not have access to this assessment. Ask the hiring team for an invite link.", 403);
    }
    const myAttempts = await prisma.assessmentAttempt.findMany({
      where: { assessmentId: a.id, candidateId: access.candidateId },
      orderBy: { startedAt: "desc" },
      take: 10,
      include: { result: true },
    });
    return successResponse({
      ...safeAssessment(a),
      access: { via: access.via, applicationId: access.applicationId ?? null },
      attempts: myAttempts,
      attemptsUsed: myAttempts.length,
    });
  } catch (e) {
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed to load assessment.", 500);
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const action = req.nextUrl.searchParams.get("action") ?? "attempt";
    if (action === "attempt") return await startAttempt(req, params.id);
    if (action === "submit") return await submitAttempt(req, params.id);
    return errorResponse("NOT_FOUND", "Unknown action.", 404);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}

async function startAttempt(req: NextRequest, assessmentId: string) {
  const rl = await checkRateLimit(rateLimitKey(req, `assess:${assessmentId}`), 20, 60_000);
  if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many attempts. Slow down.", 429);

  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Sign in as a candidate to start this assessment.", 401);

  const { invite } = z
    .object({ invite: z.string().optional() })
    .parse(await req.json().catch(() => ({})));

  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      sections: {
        include: {
          questions: {
            select: { id: true, type: true, prompt: true, options: true, points: true, sortOrder: true },
          },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
  });
  if (!assessment) return errorResponse("NOT_FOUND", "Assessment could not be found.", 404);
  if (assessment.status !== "published") return errorResponse("NOT_FOUND", "Assessment is not open.", 404);

  const access = await resolveCandidateAccess(assessment, session.sub, session.email, invite);
  if (!access) {
    return errorResponse("FORBIDDEN", "You need an invite or a matching job application to start this assessment.", 403);
  }

  // Resume an in-progress, unexpired attempt instead of silently burning one.
  const inProgress = await prisma.assessmentAttempt.findFirst({
    where: { assessmentId, candidateId: access.candidateId, status: "started" },
    orderBy: { startedAt: "desc" },
  });
  if (inProgress) {
    const expiresAt = assessment.timeLimitMin
      ? new Date(inProgress.startedAt.getTime() + assessment.timeLimitMin * 60_000)
      : null;
    if (!expiresAt || expiresAt.getTime() > Date.now()) {
      const attemptToken = await signAssessmentAttempt({
        sub: session.sub,
        attemptId: inProgress.id,
        assessmentId,
        candidateId: access.candidateId,
      });
      return successResponse({
        attemptId: inProgress.id,
        attemptToken,
        assessment: safeAssessment(assessment),
        startedAt: inProgress.startedAt.toISOString(),
        expiresAt: expiresAt?.toISOString() ?? null,
        resumed: true,
      });
    }
    await prisma.assessmentAttempt.update({ where: { id: inProgress.id }, data: { status: "expired" } });
  }

  const attemptsUsed = await prisma.assessmentAttempt.count({
    where: { assessmentId, candidateId: access.candidateId },
  });
  if (attemptsUsed >= Math.max(1, assessment.maxAttempts)) {
    return errorResponse("CONFLICT", "You have used all attempts for this assessment.", 409);
  }

  const attempt = await prisma.assessmentAttempt.create({
    data: {
      assessmentId,
      candidateId: access.candidateId,
      applicationId: access.applicationId,
      status: "started",
    },
  });
  const attemptToken = await signAssessmentAttempt({
    sub: session.sub,
    attemptId: attempt.id,
    assessmentId,
    candidateId: access.candidateId,
  });
  const expiresAt = assessment.timeLimitMin
    ? new Date(attempt.startedAt.getTime() + assessment.timeLimitMin * 60_000)
    : null;
  return successResponse(
    {
      attemptId: attempt.id,
      attemptToken,
      assessment: safeAssessment(assessment),
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: expiresAt?.toISOString() ?? null,
      resumed: false,
    },
    201
  );
}

async function submitAttempt(req: NextRequest, assessmentId: string) {
  const rl = await checkRateLimit(rateLimitKey(req, `assess:submit:${assessmentId}`), 20, 60_000);
  if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many submissions. Slow down.", 429);

  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Sign in to submit this assessment.", 401);

  const { attemptId, attemptToken, answers } = z
    .object({
      attemptId: z.string(),
      attemptToken: z.string(),
      answers: z
        .array(z.object({ questionId: z.string(), answer: z.unknown() }))
        .max(500),
    })
    .parse(await req.json());

  const token = await verifyAssessmentAttempt(attemptToken);
  if (
    !token ||
    token.sub !== session.sub ||
    token.attemptId !== attemptId ||
    token.assessmentId !== assessmentId
  ) {
    return errorResponse("FORBIDDEN", "Invalid or expired attempt token. Start the assessment again.", 403);
  }

  const attempt = await prisma.assessmentAttempt.findUnique({
    where: { id: attemptId },
    include: {
      assessment: {
        include: { sections: { include: { questions: true } } },
      },
    },
  });
  if (!attempt || attempt.assessmentId !== assessmentId) {
    return errorResponse("NOT_FOUND", "Attempt not found.", 404);
  }
  if (attempt.status !== "started") {
    return errorResponse("CONFLICT", "This attempt has already been submitted.", 409);
  }

  // The attempt must belong to the signed-in candidate.
  const candidateIds = await candidateIdsForUser(session.sub);
  const ownsAttempt =
    (attempt.candidateId && candidateIds.includes(attempt.candidateId)) ||
    (token.candidateId != null && token.candidateId === attempt.candidateId);
  if (!ownsAttempt) return errorResponse("FORBIDDEN", "Not your attempt.", 403);

  if (attempt.assessment.timeLimitMin) {
    const deadline = attempt.startedAt.getTime() + attempt.assessment.timeLimitMin * 60_000 + 60_000;
    if (Date.now() > deadline) {
      await prisma.assessmentAttempt.update({ where: { id: attempt.id }, data: { status: "expired" } });
      return errorResponse("CONFLICT", "The time limit for this attempt has passed.", 409);
    }
  }

  const questions = attempt.assessment.sections.flatMap((s) => s.questions);
  const questionById = new Map(questions.map((q) => [q.id, q]));
  const submitted = new Map<string, unknown>();
  for (const a of answers) {
    if (!questionById.has(a.questionId)) {
      return errorResponse("VALIDATION_ERROR", "An answer references a question outside this assessment.", 400);
    }
    submitted.set(a.questionId, a.answer);
  }

  let earned = 0;
  let possible = 0;
  let pendingManualReview = false;
  const breakdown: unknown[] = [];
  const gradedById = new Map<string, { correct: boolean | null; points: number }>();

  for (const q of questions) {
    possible += q.points;
    if (AUTO_GRADED.has(q.type)) {
      let correct: boolean | null = null;
      let pts = 0;
      if (submitted.has(q.id) && q.answerKey) {
        if (q.type === "multi_select") {
          const key = P<{ values?: unknown[] }>(q.answerKey, {}).values ?? [];
          const given = submitted.get(q.id);
          const normalizedGiven = Array.isArray(given) ? [...given].sort() : [];
          correct = JSON.stringify([...key].sort()) === JSON.stringify(normalizedGiven);
        } else {
          const key = P<{ value?: unknown }>(q.answerKey, {}).value ?? P<unknown>(q.answerKey, null);
          correct = JSON.stringify(key) === JSON.stringify(submitted.get(q.id));
        }
        pts = correct ? q.points : 0;
      }
      earned += pts;
      gradedById.set(q.id, { correct, points: pts });
      breakdown.push({ questionId: q.id, type: q.type, correct, points: pts, of: q.points });
    } else {
      // Free-text/scenario/coding answers are queued for human review.
      if (submitted.has(q.id)) pendingManualReview = true;
      gradedById.set(q.id, { correct: null, points: 0 });
      breakdown.push({
        questionId: q.id,
        type: q.type,
        correct: null,
        points: 0,
        of: q.points,
        answer: submitted.get(q.id) ?? null,
        manualReview: true,
      });
    }
  }

  const score = possible ? Math.round((earned / possible) * 1000) / 10 : 0;
  const passed =
    !pendingManualReview && attempt.assessment.passingScore != null
      ? score >= attempt.assessment.passingScore
      : null;

  const answerRows = questions
    .filter((q) => submitted.has(q.id))
    .map((q) => {
      const graded = gradedById.get(q.id);
      return {
        attemptId: attempt.id,
        questionId: q.id,
        answer: J(submitted.get(q.id)),
        isCorrect: graded?.correct ?? null,
        points: graded?.points ?? 0,
      };
    });

  const timeSpentSec = Math.max(
    0,
    Math.round((Date.now() - attempt.startedAt.getTime()) / 1000)
  );

  await prisma.$transaction([
    prisma.assessmentAnswer.createMany({ data: answerRows }),
    prisma.assessmentAttempt.update({
      where: { id: attempt.id },
      data: {
        status: pendingManualReview ? "submitted" : "evaluated",
        score,
        passed: passed ?? undefined,
        submittedAt: new Date(),
        timeSpentSec,
      },
    }),
    prisma.assessmentResult.create({
      data: {
        attemptId: attempt.id,
        score,
        breakdown: J(breakdown),
        feedback: pendingManualReview
          ? "Auto-graded questions scored. Free-text answers need manual review before a final decision."
          : "Auto-graded.",
      },
    }),
  ]);

  return successResponse({ score, passed, earned, possible, pendingManualReview });
}
