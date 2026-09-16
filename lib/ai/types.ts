import { z } from "zod";

// Supported AI tasks across the platform. Adding a new task = add a literal here
// + a prompt in lib/ai/prompts + a handler — no core redesign needed.
export const AI_TASKS = [
  "resume_parsing",
  "resume_evaluation",
  "job_generation",
  "question_generation",
  "candidate_matching",
  "interview_question_generation",
  "interview_evaluation",
  "roleplay_evaluation",
  "communication_assistance",
  "candidate_summary",
  "roleplay_reply",
  "interview_reply",
] as const;

export type AiTask = (typeof AI_TASKS)[number];

export interface AiCompletionOptions {
  task: AiTask;
  systemPrompt: string;
  userPrompt: string;
  /** JSON schema hint — providers request JSON mode when set */
  jsonSchema?: z.ZodTypeAny;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AiCompletionResult {
  text: string;
  /** parsed JSON when jsonSchema was provided */
  json?: unknown;
  tokensIn: number;
  tokensOut: number;
  latencyMs: number;
  provider: string;
  model: string;
}

export interface AiProvider {
  readonly name: string;
  complete(opts: AiCompletionOptions): Promise<AiCompletionResult>;
}

export const criterionEvaluationSchema = z.object({
  criteria: z.array(
    z.object({
      name: z.string(),
      score: z.number().min(0).max(100),
      confidence: z.enum(["low", "medium", "high"]),
      evidence: z.array(z.string()),
    })
  ),
});

export type CriterionEvaluation = z.infer<typeof criterionEvaluationSchema>;
