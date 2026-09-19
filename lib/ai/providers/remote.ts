import type { AiCompletionOptions, AiCompletionResult, AiProvider } from "../types";
import { fetchWithTimeout, parseJsonSafe } from "@/lib/security/fetch";

function safeParseJson(text: string, schema: AiCompletionOptions["jsonSchema"]): unknown {
  const sliced = text.slice(0, 50_000);
  let json: unknown;
  try {
    json = JSON.parse(sliced);
  } catch {
    throw new Error(`AI returned malformed JSON (preview: ${sliced.slice(0, 200)})`);
  }
  if (schema) schema.parse(json);
  return json;
}

async function chatCompletions(opts: AiCompletionOptions, endpoint: string, apiKey: string, model: string): Promise<AiCompletionResult> {
  const started = Date.now();
  const res = await fetchWithTimeout(
    endpoint,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: opts.temperature ?? 0.3,
        max_tokens: opts.maxTokens ?? 1200,
        ...(opts.jsonSchema ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
      }),
    },
    20000
  );
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} ${(await res.text()).slice(0, 500)}`);
  const data = (await parseJsonSafe(res)) as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };
  const text: string = data.choices?.[0]?.message?.content ?? "";
  let json: unknown;
  if (opts.jsonSchema) {
    json = safeParseJson(text, opts.jsonSchema);
  }
  return {
    text,
    json,
    tokensIn: data.usage?.prompt_tokens ?? Math.ceil(opts.userPrompt.length / 4),
    tokensOut: data.usage?.completion_tokens ?? Math.ceil(text.length / 4),
    latencyMs: Date.now() - started,
    provider: "openai",
    model,
  };
}

export class OpenAIProvider implements AiProvider {
  readonly name = "openai";
  constructor(private apiKey = process.env.OPENAI_API_KEY ?? "", private model = "gpt-4o-mini") {}
  complete(opts: AiCompletionOptions): Promise<AiCompletionResult> {
    if (!this.apiKey) throw new Error("OPENAI_API_KEY is not configured");
    return chatCompletions(opts, "https://api.openai.com/v1/chat/completions", this.apiKey, opts.model ?? this.model);
  }
}

export class AnthropicProvider implements AiProvider {
  readonly name = "anthropic";
  constructor(private apiKey = process.env.ANTHROPIC_API_KEY ?? "", private model = "claude-3-5-sonnet-latest") {}
  async complete(opts: AiCompletionOptions): Promise<AiCompletionResult> {
    if (!this.apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");
    const started = Date.now();
    const res = await fetchWithTimeout(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: opts.model ?? this.model,
          max_tokens: opts.maxTokens ?? 1200,
          temperature: opts.temperature ?? 0.3,
          system: opts.systemPrompt,
          messages: [{ role: "user", content: opts.userPrompt }],
        }),
      },
      20000
    );
    if (!res.ok) throw new Error(`Anthropic error: ${res.status} ${(await res.text()).slice(0, 500)}`);
    const data = (await parseJsonSafe(res)) as { content?: { text?: string }[]; usage?: { input_tokens?: number; output_tokens?: number } };
    const text: string = data.content?.map((b: { text?: string }) => b.text ?? "").join("") ?? "";
    let json: unknown;
    if (opts.jsonSchema) {
      json = safeParseJson(text, opts.jsonSchema);
    }
    return {
      text, json,
      tokensIn: data.usage?.input_tokens ?? 0,
      tokensOut: data.usage?.output_tokens ?? 0,
      latencyMs: Date.now() - started,
      provider: "anthropic",
      model: opts.model ?? this.model,
    };
  }
}

export class GeminiProvider implements AiProvider {
  readonly name = "gemini";
  constructor(private apiKey = process.env.GOOGLE_AI_API_KEY ?? "", private model = "gemini-1.5-flash") {}
  async complete(opts: AiCompletionOptions): Promise<AiCompletionResult> {
    if (!this.apiKey) throw new Error("GOOGLE_AI_API_KEY is not configured");
    const started = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${opts.model ?? this.model}:generateContent?key=${this.apiKey}`;
    const res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: opts.systemPrompt }] },
          contents: [{ parts: [{ text: opts.userPrompt }] }],
          generationConfig: {
            temperature: opts.temperature ?? 0.3,
            maxOutputTokens: opts.maxTokens ?? 1200,
            ...(opts.jsonSchema ? { responseMimeType: "application/json" } : {}),
          },
        }),
      },
      20000
    );
    if (!res.ok) throw new Error(`Gemini error: ${res.status} ${(await res.text()).slice(0, 500)}`);
    const data = (await parseJsonSafe(res)) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
    };
    const text: string = data.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("") ?? "";
    let json: unknown;
    if (opts.jsonSchema) {
      json = safeParseJson(text, opts.jsonSchema);
    }
    return {
      text, json,
      tokensIn: data.usageMetadata?.promptTokenCount ?? 0,
      tokensOut: data.usageMetadata?.candidatesTokenCount ?? 0,
      latencyMs: Date.now() - started,
      provider: "gemini",
      model: opts.model ?? this.model,
    };
  }
}
