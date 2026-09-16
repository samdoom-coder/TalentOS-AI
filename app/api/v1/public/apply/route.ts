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
import { z } from "zod";

ensureWorkers();

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
]);
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(req: NextRequest) {
  try {
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

    const job = await prisma.job.findUnique({ where: { id: input.jobId } });
    if (!job || job.deletedAt || job.status !== "published") {
      return errorResponse("NOT_FOUND", "This job is no longer accepting applications.", 404);
    }

    const file = form.get("resume");
    let storedFileId: string | undefined;
    let resumeId: string | undefined;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_BYTES) return errorResponse("VALIDATION_ERROR", "Resume must be under 10MB.", 400);
      const mime = file.type || "application/octet-stream";
      if (!ALLOWED_MIME.has(mime) && !/\.(pdf|doc|docx|txt)$/i.test(file.name)) {
        return errorResponse("VALIDATION_ERROR", "Resume must be PDF, DOC, DOCX or TXT.", 400);
      }
      const buf = Buffer.from(await file.arrayBuffer());
      const storage = getStorage();
      const saved = await storage.save(file.name, mime, buf);
      const stored = await prisma.storedFile.create({
        data: { organizationId: job.organizationId, key: saved.key, fileName: file.name, mimeType: mime, sizeBytes: saved.sizeBytes, provider: storage.name, url: saved.url },
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
      await prisma.candidateDocument.create({
        data: { candidateId: candidate.id, fileId: storedFileId, kind: "resume", fileName: (file as File).name, fileUrl: undefined, mimeType: (file as File).type, sizeBytes: (file as File).size },
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
