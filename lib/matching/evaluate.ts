import { runAi } from "@/lib/ai/service";
import { criterionEvaluationSchema } from "@/lib/ai/types";

export interface RequirementInput {
  label: string;
  category: string;
  weight: number;
  isRequired: boolean;
}

export interface EvidenceCriterion {
  name: string;
  score: number;
  confidence: "low" | "medium" | "high";
  evidence: string[];
}

/**
 * Explainable matching engine. Every score carries evidence + confidence + source.
 * Weighted overall = Σ(score × weight) / Σ(weights). Never auto-rejects.
 */
export function weightedOverall(
  criteria: { score: number; weight: number }[]
): number {
  const total = criteria.reduce((a, c) => a + c.weight, 0);
  if (!total) return 0;
  return Math.round((criteria.reduce((a, c) => a + c.score * c.weight, 0) / total) * 10) / 10;
}

export async function evaluateCandidate(opts: {
  requirements: RequirementInput[];
  resumeText: string;
  candidateSummary?: string;
  assessmentScore?: number;
  interviewScore?: number;
  organizationId?: string;
  jobId?: string;
}): Promise<EvidenceCriterion[]> {
  const reqBlock = opts.requirements
    .map((r) => `- ${r.label} [${r.category}] weight=${r.weight}${r.isRequired ? " REQUIRED" : ""}`)
    .join("\n");

  const userPrompt = [
    `JOB REQUIREMENTS:\n${reqBlock || "(no structured requirements)"}`,
    `CANDIDATE RESUME:\n${opts.resumeText.slice(0, 6000)}`,
    opts.candidateSummary ? `PROFILE SUMMARY:\n${opts.candidateSummary}` : "",
    opts.assessmentScore !== undefined ? `Assessment score: ${opts.assessmentScore}` : "",
    opts.interviewScore !== undefined ? `Interview score: ${opts.interviewScore}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const result = await runAi({
      task: "resume_evaluation",
      userPrompt,
      jsonSchema: criterionEvaluationSchema,
      organizationId: opts.organizationId,
      inputRef: opts.jobId ? `job:${opts.jobId}` : undefined,
      temperature: 0.2,
    });
    const parsed = criterionEvaluationSchema.parse(result.json);
    return parsed.criteria;
  } catch {
    // Deterministic heuristic fallback (explicitly low confidence)
    return heuristicEvaluate(opts.requirements, opts.resumeText);
  }
}

export function heuristicEvaluate(requirements: RequirementInput[], resumeText: string): EvidenceCriterion[] {
  const lowered = resumeText.toLowerCase();
  return requirements.map((r) => {
    const needle = r.label.toLowerCase();
    const hit = lowered.includes(needle);
    const partial = !hit && needle.split(/[\s/]+/).some((w) => w.length > 3 && lowered.includes(w));
    return {
      name: r.label,
      score: hit ? 75 : partial ? 45 : 15,
      confidence: "low" as const,
      evidence: hit
        ? [`Resume mentions "${r.label}".`]
        : partial
          ? [`Partial keyword overlap for "${r.label}" — verify manually.`]
          : [`No evidence of "${r.label}" found in resume (heuristic).`],
    };
  });
}
