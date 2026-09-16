// Search abstraction: Postgres search today; SearchProvider interface allows
// OpenSearch / Meilisearch / vector DB later. EmbeddingProvider stub included.

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
