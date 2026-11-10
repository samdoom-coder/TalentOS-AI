import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getEmbeddingProvider, cosine } from "@/lib/search/search";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

// Semantic candidate search: embedding cosine when configured, keyword fallback.
// GET /api/v1/search/semantic?orgId=&q=  (also POST {orgId, query})
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const q = req.nextUrl.searchParams.get("q") ?? "";
  if (!orgId || !q.trim()) return errorResponse("VALIDATION_ERROR", "orgId + q required.", 400);
  return runSemantic(req, orgId, q);
}

export async function POST(req: NextRequest) {
  try {
    const rl = await checkRateLimit(rateLimitKey(req, "search:semantic"), 30, 60_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many searches.", 429);
    const { orgId, query } = z.object({ orgId: z.string(), query: z.string().min(2).max(500) }).parse(await req.json());
    return runSemantic(req, orgId, query);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", "Search failed.", 500);
  }
}

async function runSemantic(_req: NextRequest, orgId: string, query: string) {
  try {
    const { membership } = await requireOrgAccess(orgId);
    if (!can(membership.role, "candidates:view")) return errorResponse("FORBIDDEN", "No access.", 403);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const cands = await prisma.candidate.findMany({
    where: { organizationId: orgId, deletedAt: null },
    include: { skills: { take: 20 }, experience: { take: 5 } },
    take: 50, orderBy: { createdAt: "desc" },
  });
  const provider = getEmbeddingProvider();
  if (provider.name === "noop") {
    // Keyword fallback with explainable overlap (no silent vector claim).
    const ql = query.toLowerCase();
    const ranked = cands.map((c) => {
      const text = [c.name, c.title ?? "", c.skills.map((s) => s.skill).join(" "), c.experience.map((e) => `${e.role} ${e.company}`).join(" ")].join(" ").toLowerCase();
      const hits = ql.split(/\s+/).filter((w) => w.length > 2 && text.includes(w)).length;
      return { id: c.id, name: c.name, title: c.title, email: c.email, score: Math.min(99, hits * 22), method: "keyword" };
    }).sort((a, b) => b.score - a.score).slice(0, 20);
    return successResponse({ method: "keyword", note: "Set FEATURE_SEMANTIC_SEARCH=true + OPENAI_API_KEY for vector ranking.", results: ranked });
  }
  try {
    const qEmb = await provider.embed(query);
    const scored = [] as { id: string; name: string; title: string | null; email: string; score: number }[];
    for (const c of cands.slice(0, 30)) {
      const text = [c.title ?? "", c.skills.map((s) => s.skill).join(", "), c.experience.map((e) => `${e.role} at ${e.company}`).join("; ")].join("\n").slice(0, 2000) || c.name;
      const emb = await provider.embed(text).catch(() => [] as number[]);
      const sim = cosine(qEmb, emb);
      scored.push({ id: c.id, name: c.name, title: c.title, email: c.email, score: Math.round(sim * 1000) / 10 });
    }
    scored.sort((a, b) => b.score - a.score);
    return successResponse({ method: "vector", results: scored.slice(0, 20) });
  } catch (e) {
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Vector search failed.", 500);
  }
}
