// Search abstraction: Postgres search today; SearchProvider interface allows
// OpenSearch / Meilisearch / vector DB later. EmbeddingProvider: OpenAI when
// configured (FEATURE_SEMANTIC_SEARCH=true + OPENAI_API_KEY), else noop.

import { fetchWithTimeout } from "@/lib/security/fetch";

export interface CandidateFilters {
  q?: string;
  skills?: string[];
  minYears?: number;
  location?: string;
  stage?: string;
  minScore?: number;
  maxScore?: number;
  jobId?: string;
}

export interface SearchProvider {
  readonly name: string;
  searchCandidates(orgId: string, filters: CandidateFilters): Promise<{ where: object }>;
}

export class PostgresSearchProvider implements SearchProvider {
  readonly name = "postgres";
  async searchCandidates(_orgId: string, _filters: CandidateFilters) {
    // Where-clause construction happens in the API route (Prisma); this marks the seam.
    return { where: {} };
  }
}

// Vector/semantic search seam (opt-in via FEATURE_SEMANTIC_SEARCH).
export interface EmbeddingProvider {
  readonly name: string;
  embed(text: string): Promise<number[]>;
}

export class NoopEmbeddingProvider implements EmbeddingProvider {
  readonly name = "noop";
  async embed(_text: string): Promise<number[]> {
    return [];
  }
}

export class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";
  async embed(text: string): Promise<number[]> {
    const key = process.env.OPENAI_API_KEY as string;
    const res = await fetchWithTimeout("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: process.env.OPENAI_EMBED_MODEL ?? "text-embedding-3-small", input: text.slice(0, 8000) }),
    }, 20000);
    if (!res.ok) throw new Error(`embeddings ${res.status}`);
    const data = await res.json() as { data?: { embedding?: number[] }[] };
    return data.data?.[0]?.embedding ?? [];
  }
}

export function getEmbeddingProvider(): EmbeddingProvider {
  if (process.env.FEATURE_SEMANTIC_SEARCH === "true" && process.env.OPENAI_API_KEY) {
    return new OpenAIEmbeddingProvider();
  }
  return new NoopEmbeddingProvider();
}

export function cosine(a: number[], b: number[]): number {
  if (!a.length || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0;
}
