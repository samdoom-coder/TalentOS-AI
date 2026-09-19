import { prisma } from "@/lib/db/prisma";
import { J } from "@/lib/db/json";
import type { AiCompletionOptions, AiProvider, AiTask } from "./types";
import { MockProvider } from "./providers/mock";
import { AnthropicProvider, GeminiProvider, OpenAIProvider } from "./providers/remote";
import { getPrompt } from "./prompts/registry";

/**
 * Central AI entrypoint. Every important execution is recorded in ai_runs
 * (provider, model, prompt version, tokens, latency, cost, status) for auditability.
 * Mock fallback is OPT-IN ONLY (allowFallback: true) and always marked
 * `fallback:mock` — scoring paths must never fabricate results on provider failure.
 */
export function getProvider(name?: string): AiProvider {
  const selected = (name ?? process.env.AI_PROVIDER ?? "mock").toLowerCase();
  switch (selected) {
    case "openai":
      return new OpenAIProvider();
    case "anthropic":
      return new AnthropicProvider();
    case "gemini":
      return new GeminiProvider();
    case "local":
      return new MockProvider(); // LocalModelProvider slot: plug Ollama/vLLM here
    default:
      return new MockProvider();
  }
}

export interface RunAiInput extends Omit<AiCompletionOptions, "systemPrompt"> {
  task: AiTask;
  promptVersion?: string;
  systemPrompt?: string;
  organizationId?: string;
  inputRef?: string;
  allowFallback?: boolean;
}

const COST_PER_1K: Record<string, number> = {
  openai: 0.0006,
  anthropic: 0.003,
  gemini: 0.0004,
  mock: 0,
};

export async function runAi(input: RunAiInput) {
  const prompt = getPrompt(input.task, input.promptVersion);
  const systemPrompt = input.systemPrompt ?? prompt.system;
  const primary = getProvider();
  const started = Date.now();

  const attempt = async (provider: AiProvider) =>
    provider.complete({
      task: input.task,
      systemPrompt,
      userPrompt: input.userPrompt,
      jsonSchema: input.jsonSchema,
      temperature: input.temperature,
      maxTokens: input.maxTokens,
      model: input.model,
    });

  try {
    const result = await withRetry(() => attempt(primary), 2);
    await recordRun(input, prompt.version, result, "succeeded");
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI provider failed";
    await recordRun(
      input,
      prompt.version,
      { provider: primary.name, model: input.model ?? "unknown", tokensIn: 0, tokensOut: 0, latencyMs: Date.now() - started },
      "failed",
      message
    );
    // Explicit opt-in fallback only (marked as mock). Production scoring paths
    // call with allowFallback unset/false, so failures surface instead of
    // fabricating scores. Never enable by default in production.
    if (input.allowFallback === true && primary.name !== "mock") {
      const fallback = await attempt(new MockProvider());
      await recordRun(input, prompt.version, { ...fallback, provider: `fallback:${fallback.provider}` }, "succeeded");
      return fallback;
    }
    throw new Error(message);
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
  let last: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : "";
      // Don't retry auth/config errors
      if (/not configured|401|403/i.test(msg)) break;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw last;
}

async function recordRun(
  input: RunAiInput,
  promptVersion: string,
  result: { provider: string; model: string; tokensIn: number; tokensOut: number; latencyMs: number; text?: string; json?: unknown },
  status: string,
  error?: string
) {
  const rate = COST_PER_1K[result.provider.replace("fallback:", "")] ?? 0;
  const costUsd = ((result.tokensIn + result.tokensOut) / 1000) * rate;
  try {
    await prisma.aiRun.create({
      data: {
        organizationId: input.organizationId,
        task: input.task,
        provider: result.provider,
        model: result.model,
        promptVersion,
        inputRef: input.inputRef,
        output: J(result.json !== undefined ? result.json : { text: (result.text ?? "").slice(0, 4000) }),
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        latencyMs: result.latencyMs,
        costUsd,
        status,
        error,
      },
    });
    if (input.organizationId && status === "succeeded") {
      const day = new Date().toISOString().slice(0, 10);
      await prisma.aiModelUsage.upsert({
        where: { id: `${input.organizationId}-${result.provider}-${result.model}-${day}` },
        update: {
          tokensIn: { increment: result.tokensIn },
          tokensOut: { increment: result.tokensOut },
          costUsd: { increment: costUsd },
        },
        create: {
          id: `${input.organizationId}-${result.provider}-${result.model}-${day}`,
          organizationId: input.organizationId,
          provider: result.provider,
          model: result.model,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          costUsd,
          day,
        },
      }).catch(() => undefined);
    }
  } catch {
    // audit logging must never break the request
  }
}
