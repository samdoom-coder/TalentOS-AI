import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { evaluateCandidate, weightedOverall } from "@/lib/matching/evaluate";
import { audit } from "@/lib/audit/audit";

// AI candidate matching: requirements + resume + scores -> evidence-linked match.
export async function POST(req: NextRequest) {
  try {
    const { jobId, candidateId, weights } = z.object({
      jobId: z.string(),
      candidateId: z.string(),
      weights: z.record(z.number()).optional(),
    }).parse(await req.json());
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: { requirements: true } });
    const candidate = await prisma.candidate.findUnique({ where: { id: candidateId }, include: { skills: true, experience: true } });
    if (!job || !candidate) return errorResponse("NOT_FOUND", "Job or candidate not found.", 404);
    const { session } = await requireOrgAccess(job.organizationId);

    const resumeText = [
      candidate.summary ?? "",
      candidate.skills.map((s) => s.skill).join(", "),
      candidate.experience.map((e) => `${e.role} at ${e.company}: ${e.description ?? ""}`).join("\n"),
    ].join("\n");
    const criteria = await evaluateCandidate({
      requirements: job.requirements.map((r) => ({ label: r.label, category: r.category, weight: weights?.[r.label] ?? r.weight, isRequired: r.isRequired })),
      resumeText,
      organizationId: job.organizationId,
      jobId,
    });
    const overall = weightedOverall(criteria.map((c) => ({ score: c.score, weight: weights?.[c.name] ?? 10 })));
    await prisma.candidateScore.create({ data: { candidateId, jobId, scope: "overall", score: overall, confidence: "medium", model: "audited" } });
    await prisma.application.updateMany({ where: { jobId, candidateId }, data: { matchScore: overall } });
    await audit({ organizationId: job.organizationId, actorId: session.sub, action: "ai.match_generated", resource: "candidate", resourceId: candidateId, metadata: { jobId, overall } });
    return successResponse({ overall, criteria });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Matching failed.", status);
  }
}
