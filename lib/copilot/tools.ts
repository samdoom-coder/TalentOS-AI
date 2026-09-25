import { z } from "zod";

// Tool-based architecture per spec #86. All tools are organization-scoped and
// permission-checked in executor.ts. Destructive actions never execute directly:
// they return a proposal with `needsConfirmation: true` + deep link.

export const searchCandidatesSchema = z.object({
  query: z.string().max(120).optional(),
  skill: z.string().max(60).optional(),
  stage: z.string().max(40).optional(),
  jobId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(25).default(8),
});

export const getCandidateSchema = z.object({
  candidateId: z.string().min(1).max(80),
});

export const getJobSchema = z.object({
  jobId: z.string().min(1).max(80),
});

export const summarizeCandidateSchema = z.object({
  candidateId: z.string().min(1).max(80),
  jobId: z.string().min(1).max(80).optional(),
});

export const getAnalyticsSchema = z.object({
  jobId: z.string().min(1).max(80).optional(),
});

export const draftEmailSchema = z.object({
  to: z.string().email().optional(),
  candidateId: z.string().min(1).max(80).optional(),
  subject: z.string().min(3).max(140),
  body: z.string().min(3).max(4000),
  template: z.string().max(60).optional(),
});

export const proposeActionSchema = z.object({
  kind: z.enum(["create_assessment", "schedule_interview", "send_email", "move_stage"]),
  summary: z.string().min(3).max(500),
  href: z.string().min(1).max(300),
  payload: z.record(z.unknown()).optional(),
});

export type ToolName =
  | "searchCandidates"
  | "getCandidate"
  | "getJob"
  | "summarizeCandidate"
  | "getAnalytics"
  | "draftEmail"
  | "proposeAction";

export const TOOL_DESCRIPTIONS: Record<ToolName, string> = {
  searchCandidates: "Permission-aware candidate search (org-scoped).",
  getCandidate: "Full candidate profile with skills, experience, applications.",
  getJob: "Job + requirements + applicant counts.",
  summarizeCandidate: "Strengths, gaps, evidence, follow-up questions.",
  getAnalytics: "Funnel, conversion, time-to-hire, AI cost.",
  draftEmail: "Draft only — recruiter approves before any send.",
  proposeAction: "Destructive ops return a confirmation proposal, never execute.",
};

export interface PlannedCall {
  tool: ToolName;
  args: Record<string, unknown>;
}

const SKILL_HINTS = [
  "react", "next.js", "nextjs", "typescript", "python", "java", "go", "node",
  "postgres", "postgresql", "aws", "docker", "ml", "data",
];

const STAGE_HINTS = [
  "applied", "screening", "assessment", "interview", "technical_interview",
  "final_interview", "offer", "hired", "rejected",
];

/**
 * Deterministic intent router — works offline (mock provider) and is fully
 * unit-testable. The LLM only synthesizes prose from tool evidence, never
 * decides authorization.
 */
export function routeCopilotIntent(message: string): PlannedCall[] {
  const m = message.toLowerCase();

  if (/(draft|write|compose).*(email|invit|message|offer|reject)/.test(m)) {
    return [{ tool: "draftEmail", args: {} }];
  }
  if (/(funnel|analytics|conversion|time to hire|how.*hiring|pipeline health|cost|tokens)/.test(m)) {
    return [{ tool: "getAnalytics", args: {} }];
  }
  if (/(summariz|summary|profile|tell me about|review candidate)/.test(m)) {
    return [
      { tool: "searchCandidates", args: { query: extractQuoted(message) ?? "", limit: 3 } },
      { tool: "getAnalytics", args: {} },
    ];
  }
  if (/(missing|gap|requirement|what should i ask|interview question|follow.?up)/.test(m)) {
    return [
      { tool: "searchCandidates", args: { limit: 5 } },
      { tool: "getAnalytics", args: {} },
    ];
  }
  if (/(waiting|pending|review|stuck|screening|applied|shortlist)/.test(m)) {
    const stage = STAGE_HINTS.find((s) => m.includes(s)) ?? "screening";
    return [
      { tool: "searchCandidates", args: { stage, limit: 8 } },
      { tool: "getAnalytics", args: {} },
    ];
  }
  if (/(show|find|search|list|candidates? for|react|engineer|developer|designer)/.test(m)) {
    const skill = SKILL_HINTS.find((s) => m.includes(s));
    const query = extractQuoted(message);
    return [
      {
        tool: "searchCandidates",
        args: { ...(query ? { query } : {}), ...(skill ? { skill } : {}), limit: 8 },
      },
    ];
  }
  // Default: helpful overview, not an empty dead-end.
  return [
    { tool: "searchCandidates", args: { limit: 5 } },
    { tool: "getAnalytics", args: {} },
  ];
}

function extractQuoted(message: string): string | undefined {
  const quoted = message.match(/["“”']([^"“”']{2,60})["“”']/);
  if (quoted?.[1]) return quoted[1].trim();
  const forMatch = message.match(/for\s+([a-z0-9 .+#-]{3,40})\b/i);
  if (forMatch?.[1] && !/this job|this role|review|hire/i.test(forMatch[1])) return forMatch[1].trim();
  return undefined;
}
