// Simple in-process rate limiter (dev + single-instance safe).
// Production with multiple instances: swap internals for Redis (same interface).
// Keyed by e.g. `ip:/api/v1/auth/login` or `user:<id>:coding-submit`.

const buckets = new Map<string, number[]>();

declare global {
  // Persist across Next.js HMR in dev
  // eslint-disable-next-line no-var
  var __talentosRateBuckets: Map<string, number[]> | undefined;
}

function store(): Map<string, number[]> {
  if (typeof globalThis !== "undefined" && (globalThis as Record<string, unknown>).__talentosRateBuckets) {
    return (globalThis as Record<string, unknown>).__talentosRateBuckets as Map<string, number[]>;
  }
  if (typeof globalThis !== "undefined") {
    (globalThis as Record<string, unknown>).__talentosRateBuckets = buckets;
  }
  return buckets;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetMs: number;
}

/** Sliding-window check. Returns allowed=false when limit exceeded. */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const s = store();
  const hits = (s.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return { allowed: false, remaining: 0, resetMs: oldest + windowMs - now };
  }
  hits.push(now);
  // Bound memory: keep at most `limit` timestamps per key, prune old keys lazily
  s.set(key, hits.slice(-limit));
  if (s.size > 5000) {
    const first = s.keys().next().value as string | undefined;
    if (first) s.delete(first);
  }
  return { allowed: true, remaining: limit - hits.length, resetMs: windowMs };
}

export function clientIp(req: Request): string {
  const h = (name: string) => req.headers.get(name);
  const forwarded = h("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return h("x-real-ip") ?? "unknown";
}

export function rateLimitKey(req: Request, scope: string): string {
  return `${clientIp(req)}:${scope}`;
}
