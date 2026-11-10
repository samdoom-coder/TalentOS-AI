import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { J } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { applicationSchema } from "@/lib/validations";
import { getStorage } from "@/lib/storage/storage";
import { enqueue } from "@/lib/queue/queue";
import { sendEmail, MESSAGE_TEMPLATES, renderTemplate } from "@/lib/email/email";
import { audit, notifyOrgMembers } from "@/lib/audit/audit";
import { emitEvent } from "@/lib/webhooks/webhooks";
import { ensureWorkers } from "@/lib/bootstrap";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { validateResumeUpload } from "@/lib/security/uploads";
import { getSession } from "@/lib/auth/session";
import { linkCandidateToUser } from "@/lib/candidates/identity";
import { z } from "zod";

ensureWorkers();

const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(rateLimitKey(req, "public:apply"), 10, 3600_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many applications. Try again later.", 429);
    const form = await req.formData();
    const fields: Record<string, string> = {};
    for (const [k, v] of form.entries()) {
      if (typeof v === "string") fields[k] = v;
    }
    const answers: Record<string, string> = {};
    for (const [k, v] of Object.entries(fields)) {
      if (k.startsWith("q_")) answers[k.slice(2)] = v;
    }
    const input = applicationSchema.parse({
      jobId: fields.jobId,
      name: fields.name,
      email: fields.email,
      phone: fields.phone,
      location: fields.location,
      title: fields.title,
      linkedinUrl: fields.linkedinUrl,
      githubUrl: fields.githubUrl,
      portfolioUrl: fields.portfolioUrl,
      answers,
      consent: fields.consent === "true" || fields.consent === "on",
    });

    const job = await prisma.job.findUnique({
      where: { id: input.jobId },
      include: { questions: { orderBy: { sortOrder: "asc" } } },
    });
    if (!job || job.deletedAt || job.status !== "published") {
      return errorResponse("NOT_FOUND", "This job is no longer accepting applications.", 404);
    }

    // Only accept answers to this job's questions; enforce required ones.
    const questionById = new Map(job.questions.map((q) => [q.id, q]));
    for (const key of Object.keys(answers)) {
      if (!questionById.has(key)) {
        return errorResponse("VALIDATION_ERROR", "An answer references a question that does not belong to this job.", 400);
      }
    }
    for (const q of job.questions) {
      if (q.required && !answers[q.id]?.trim()) {
        return errorResponse("VALIDATION_ERROR", `Please answer: ${q.question}`, 400);
      }
    }

    const file = form.get("resume");
    let storedFileId: string | undefined;
    let resumeId: string | undefined;
    if (file instanceof File && file.size > 0) {
      const buf = Buffer.from(await file.arrayBuffer());
      // Server-side validation: magic bytes + extension + size. Never trust file.type.
      const checked = validateResumeUpload(file.name, file.type, buf, MAX_BYTES);
      if (!checked.ok) return errorResponse("VALIDATION_ERROR", checked.error, 400);
      const storage = getStorage();
      const saved = await storage.save(checked.value.safeName, checked.value.mimeType, buf);
      const stored = await prisma.storedFile.create({
        data: { organizationId: job.organizationId, key: saved.key, fileName: checked.value.safeName, mimeType: checked.value.mimeType, sizeBytes: saved.sizeBytes, provider: storage.name, url: saved.url },
      });
      storedFileId = stored.id;
    }

    // Upsert candidate within the org (scoped by email)
    let candidate = await prisma.candidate.findFirst({ where: { organizationId: job.organizationId, email: input.email.toLowerCase() } });
    if (!candidate) {
      candidate = await prisma.candidate.create({
        data: {
          organizationId: job.organizationId,
          name: input.name,
          email: input.email.toLowerCase(),
          phone: input.phone,
          location: input.location,
          title: input.title,
          linkedinUrl: input.linkedinUrl,
          githubUrl: input.githubUrl,
          portfolioUrl: input.portfolioUrl,
        },
      });
    }

    const existing = await prisma.application.findUnique({ where: { jobId_candidateId: { jobId: job.id, candidateId: candidate.id } } });
    if (existing) return errorResponse("CONFLICT", "You have already applied to this job.", 409);

    // If a candidate is signed in and applying with their own address, link the
    // org candidate record to their account so the candidate portal can see it.
    const session = await getSession().catch(() => null);
    if (session && session.role === "candidate" && session.email.toLowerCase() === input.email.toLowerCase()) {
      await linkCandidateToUser(candidate.id, session.sub);
    }

    const application = await prisma.application.create({
      data: {
        organizationId: job.organizationId,
        jobId: job.id,
        candidateId: candidate.id,
        stage: "applied",
        source: fields.source ?? "careers_page",
        answers: J(answers),
        events: { create: { type: "applied", message: `${input.name} applied` } },
        stageHistory: { create: { toStage: "applied", note: "Application submitted" } },
      },
    });

    if (storedFileId) {
      const stored = await prisma.storedFile.findUnique({ where: { id: storedFileId } });
      await prisma.candidateDocument.create({
        data: {
          candidateId: candidate.id,
          fileId: storedFileId,
          kind: "resume",
          fileName: stored?.fileName ?? "resume",
          fileUrl: undefined,
          mimeType: stored?.mimeType ?? "application/octet-stream",
          sizeBytes: stored?.sizeBytes ?? 0,
        },
      });
      const resume = await prisma.resume.create({ data: { candidateId: candidate.id, applicationId: application.id, fileId: storedFileId, status: "queued" } });
      resumeId = resume.id;
      await enqueue("resume-processing", "parse-resume", { resumeId: resume.id });
      await prisma.consentRecord.create({ data: { candidateId: candidate.id, type: "resume_processing", version: "v1", granted: true } });
    }

    // Confirmation email (queued)
    await sendEmail({
      organizationId: job.organizationId,
      to: candidate.email,
      subject: renderTemplate(MESSAGE_TEMPLATES.application_received.subject, { job_title: job.title, company_name: "our team" }),
      body: renderTemplate(MESSAGE_TEMPLATES.application_received.body, { candidate_name: candidate.name, job_title: job.title, company_name: "our team" }),
      template: "application_received",
      candidateId: candidate.id,
      applicationId: application.id,
    }).catch(() => undefined);

    await notifyOrgMembers(job.organizationId, { type: "new_application", title: "New application", body: `${candidate.name} applied to ${job.title}`, link: `/candidates/${candidate.id}` });
    await audit({ organizationId: job.organizationId, action: "candidate.applied", resource: "application", resourceId: application.id, metadata: { jobId: job.id } });
    await emitEvent(job.organizationId, "application.created", { applicationId: application.id, jobId: job.id, candidateId: candidate.id });

    return successResponse({ applicationId: application.id, candidateId: candidate.id, resumeId, resumeStatus: storedFileId ? "queued" : "no_resume" }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Please check the form and try again.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Application failed.", 500);
  }
}
