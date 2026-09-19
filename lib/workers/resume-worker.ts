import { prisma } from "@/lib/db/prisma";
import { J } from "@/lib/db/json";
import { registerHandler } from "@/lib/queue/queue";
import { extractTextFromBufferAsync, parseResumeText, experienceYears } from "@/lib/resumes/parse";
import { evaluateCandidate, weightedOverall } from "@/lib/matching/evaluate";
import { getStorage } from "@/lib/storage/storage";
import { notifyOrgMembers, audit } from "@/lib/audit/audit";
import { emitEvent } from "@/lib/webhooks/webhooks";

// Async resume pipeline: Upload -> Storage -> Queue -> Text extraction ->
// Structured parse -> Skill/experience extraction -> AI evaluation.

export function registerResumeWorkers() {
  registerHandler("resume-processing", "parse-resume", async (job) => {
    const { resumeId } = job.payload as { resumeId: string };
    const resume = await prisma.resume.findUnique({ where: { id: resumeId } });
    if (!resume) return;

    await prisma.resume.update({ where: { id: resumeId }, data: { status: "processing" } });
    try {
      const file = await prisma.storedFile.findUnique({ where: { id: resume.fileId } });
      if (!file) throw new Error("File record missing");
      const storage = getStorage();
      const buf = await storage.read(file.key);
      const { text, provider } = await extractTextFromBufferAsync(buf, file.mimeType ?? undefined, file.fileName ?? undefined);
      const parsed = parseResumeText(text);
      const yrs = experienceYears(text);

      await prisma.resumeParsingResult.upsert({
        where: { resumeId },
        update: { rawText: text.slice(0, 20000), structured: J(parsed), skills: J(parsed.skills), experience: J(parsed.experience), education: J(parsed.education), confidence: "medium", provider },
        create: { resumeId, rawText: text.slice(0, 20000), structured: J(parsed), skills: J(parsed.skills), experience: J(parsed.experience), education: J(parsed.education), confidence: "medium", provider },
      });

      // Attach to candidate if linked
      const application = resume.applicationId ? await prisma.application.findUnique({ where: { id: resume.applicationId }, include: { candidate: true, job: { include: { requirements: true } } } }) : null;
      const candidateId = resume.candidateId ?? application?.candidateId;
      if (candidateId) {
        if (parsed.name) await prisma.candidate.update({ where: { id: candidateId }, data: { name: parsed.name } }).catch(() => undefined);
        await prisma.candidate.update({ where: { id: candidateId }, data: { experienceYrs: yrs } }).catch(() => undefined);
        for (const s of parsed.skills.slice(0, 30)) {
          await prisma.candidateSkill.create({ data: { candidateId, skill: s } }).catch(() => undefined);
        }
        for (const e of parsed.experience.slice(0, 10)) {
          await prisma.candidateExperience.create({
            data: { candidateId, company: e.company ?? "Unknown", role: e.role ?? "Unknown", description: e.description },
          }).catch(() => undefined);
        }
        // AI evaluation against job requirements (explainable, evidence-linked)
        if (application?.job) {
          const criteria = await evaluateCandidate({
            requirements: application.job.requirements.map((r) => ({ label: r.label, category: r.category, weight: r.weight, isRequired: r.isRequired })),
            resumeText: text,
            organizationId: application.organizationId,
            jobId: application.jobId,
          }).catch(() => []);
          for (const c of criteria) {
            await prisma.candidateEvidence.create({
              data: { candidateId, jobId: application.jobId, requirement: c.name, evidence: c.evidence.join(" "), assessment: `score ${c.score}`, confidence: c.confidence, source: "resume", score: c.score },
            });
          }
          if (criteria.length) {
            const reqWeights = application.job.requirements.map((r) => ({ label: r.label, weight: r.weight }));
            const overall = weightedOverall(criteria.map((c) => ({ score: c.score, weight: reqWeights.find((w) => w.label === c.name)?.weight ?? 10 })));
            await prisma.application.update({ where: { id: application.id }, data: { matchScore: overall } });
            await prisma.candidateScore.create({ data: { candidateId, jobId: application.jobId, scope: "resume", score: overall, confidence: "medium", model: "mock-v1" } });
          }
        }
      }

      await prisma.resume.update({ where: { id: resumeId }, data: { status: "completed" } });
      if (application) {
        await prisma.applicationEvent.create({ data: { applicationId: application.id, type: "resume_processed", message: "Resume processed" } });
        await notifyOrgMembers(application.organizationId, { type: "resume_processed", title: "Resume processed", body: `Application ${application.id.slice(0, 8)}`, link: `/candidates` });
        await emitEvent(application.organizationId, "resume.processed", { applicationId: application.id });
      }
    } catch (e) {
      await prisma.resume.update({ where: { id: resumeId }, data: { status: "failed", error: e instanceof Error ? e.message : "parse failed" } });
      throw e;
    }
  });
}

export { audit };
