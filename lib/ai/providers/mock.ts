import type { AiCompletionOptions, AiCompletionResult, AiProvider } from "../types";

/**
 * Deterministic offline provider used for dev/test and as a fallback.
 * Produces explainable, evidence-linked stub evaluations without network calls.
 */
export class MockProvider implements AiProvider {
  readonly name = "mock";

  async complete(opts: AiCompletionOptions): Promise<AiCompletionResult> {
    const started = Date.now();
    // tiny delay to simulate async work without slowing tests
    await new Promise((r) => setTimeout(r, 25));
    const text = this.respond(opts);
    let json: unknown;
    if (opts.jsonSchema) {
      try {
        json = JSON.parse(text);
        opts.jsonSchema.parse(json);
      } catch {
        json = undefined;
      }
    }
    return {
      text,
      json,
      tokensIn: Math.ceil((opts.systemPrompt.length + opts.userPrompt.length) / 4),
      tokensOut: Math.ceil(text.length / 4),
      latencyMs: Date.now() - started,
      provider: "mock",
      model: "mock-v1",
    };
  }

  private respond(opts: AiCompletionOptions): string {
    const wantsJson = Boolean(opts.jsonSchema);
    if (wantsJson) {
      return JSON.stringify({
        criteria: [
          {
            name: "Relevant experience",
            score: 72,
            confidence: "medium",
            evidence: ["Evidence extracted from the provided context (mock evaluation)."],
          },
          {
            name: "Technical skills",
            score: 68,
            confidence: "medium",
            evidence: ["Keyword overlap between requirements and candidate profile (mock)."],
          },
        ],
      });
    }
    switch (opts.task) {
      case "job_generation":
        return [
          "## Generated draft (mock)",
          "Review and edit before publishing.",
          "- Responsibilities: own features end-to-end, write tested code, collaborate in reviews.",
          "- Required skills: per the brief provided.",
          "- Interview plan: 1 screening, 1 practical assessment, 1 AI interview.",
        ].join("\n");
      case "interview_reply":
        return "Thanks for that detail. Can you walk me through a specific challenge you faced there and how you measured the outcome?";
      case "roleplay_reply":
        return "I see — thanks for explaining. I still have a concern about the timeline. How would you handle it if we needed this resolved by Friday?";
      case "candidate_summary":
        return "Overview: candidate shows relevant hands-on experience. Strengths: practical delivery, communication. Gaps: verify depth with a follow-up interview. (Mock summary — connect an AI provider for full analysis.)";
      case "communication_assistance":
        return "Hi {{candidate_name}}, thanks for your interest in {{job_title}} at {{company_name}}. Next step: {{assessment_link}}. (Mock draft — edit before sending.)";
      default:
        return "Mock AI response. Configure OPENAI_API_KEY / ANTHROPIC_API_KEY / GOOGLE_AI_API_KEY and set AI_PROVIDER to enable live models.";
    }
  }
}
