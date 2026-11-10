// Rate limiting for API routes.
//
// Production: when REDIS_URL is set, limits are enforced atomically in Redis
// with a sliding-window sorted set, so every web instance shares the same
// buckets. If Redis is unreachable the request falls back to the local
// in-memory limiter (availability over strictness) and recovers automatically.
//
// Dev/single-instance: no REDIS_URL, so the in-memory limiter is used.

import { createHash } from "crypto";
import { connectRedis, type RedisConn } from "@/lib/queue/redis";

const buckets = new Map<string, number[]>();

declare global {
  // Persist across Next.js HMR in dev
  // eslint-disable-next-line no-var
  var __talentosRateBuckets: Map<string, number[]> | undefined;
  // eslint-disable-next-line no-var
  var __talentosRateRedis:
    | {
        conn: RedisConn | null;
        url: string;
        connecting: Promise<RedisConn> | null;
        retryAt: number;
      }
    | undefined;
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
  /** Which backend made the decision. Useful for health/debug endpoints. */
  driver?: "redis" | "memory" | "memory-fallback";
}

/** Sliding-window check in this process. Used in dev and as Redis fallback. */
function memoryCheck(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const s = store();
  const hits = (s.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    const oldest = hits[0] ?? now;
    return { allowed: false, remaining: 0, resetMs: oldest + windowMs - now, driver: "memory" };
  }
  hits.push(now);
  // Bound memory: keep at most `limit` timestamps per key, prune old keys lazily
  s.set(key, hits.slice(-limit));
  if (s.size > 5000) {
    const first = s.keys().next().value as string | undefined;
    if (first) s.delete(first);
  }
  return { allowed: true, remaining: limit - hits.length, resetMs: windowMs, driver: "memory" };
}

// Atomic sliding window. One round-trip per check, shared across web instances.
const REDIS_LUA = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local member = ARGV[4]

redis.call("ZREMRANGEBYSCORE", key, "-inf", now - window)
local count = redis.call("ZCARD", key)
if count >= limit then
  local oldest = redis.call("ZRANGE", key, 0, 0, "WITHSCORES")
  local reset = window
  if oldest[2] then
    reset = math.max(0, tonumber(oldest[2]) + window - now)
  end
  return {0, 0, reset}
end

redis.call("ZADD", key, now, member)
redis.call("PEXPIRE", key, window)
return {1, limit - count - 1, window}
`;

function redisState() {
  if (!globalThis.__talentosRateRedis) {
    globalThis.__talentosRateRedis = { conn: null, url: "", connecting: null, retryAt: 0 };
  }
  return globalThis.__talentosRateRedis;
}

async function redisConnection(url: string): Promise<RedisConn> {
  const state = redisState();
  if (state.conn && state.url === url) return state.conn;

  if (state.conn && state.url !== url) {
    state.conn.close();
    state.conn = null;
  }

  if (!state.connecting) {
    state.url = url;
    state.connecting = connectRedis(url, 1000)
      .then((conn) => {
        state.conn = conn;
        return conn;
      })
      .finally(() => {
        state.connecting = null;
      });
  }
  return state.connecting;
}

function redisKey(key: string): string {
  // Avoid unbounded key sizes while keeping distinct long keys distinct.
  const safe = key.length > 200 ? createHash("sha256").update(key).digest("hex") : key;
  return `talentos:ratelimit:${safe}`;
}

async function redisCheck(
  url: string,
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const conn = await redisConnection(url);
  const now = Date.now();
  const member = `${now}-${Math.random().toString(36).slice(2, 10)}`;
  const raw = (await conn.cmd(
    "EVAL",
    REDIS_LUA,
    "1",
    redisKey(key),
    String(now),
    String(windowMs),
    String(limit),
    member
  )) as unknown[];
  const [allowed, remaining, resetMs] = (Array.isArray(raw) ? raw : []).map(Number);
  return {
    allowed: allowed === 1,
    remaining: Number.isFinite(remaining) ? remaining : 0,
    resetMs: Number.isFinite(resetMs) ? resetMs : windowMs,
    driver: "redis",
  };
}

/** Sliding-window check. Returns allowed=false when limit exceeded. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number
): Promise<RateLimitResult> {
  const url = globalThis.process?.env?.REDIS_URL || "";
  const state = redisState();

  // Circuit breaker: after a Redis failure, use local limits for a few
  // seconds instead of making every request wait on a dead connection.
  if (url && Date.now() >= state.retryAt) {
    try {
      try {
        const result = await redisCheck(url, key, limit, windowMs);
        state.retryAt = 0;
        return result;
      } catch (first) {
        // The cached socket may have been closed by Redis or a network blip.
        // Drop it and retry once before degrading to local limits.
        if (state.conn) {
          try {
            state.conn.close();
          } catch {
            // ignore
          }
          state.conn = null;
        }
        try {
          const result = await redisCheck(url, key, limit, windowMs);
          state.retryAt = 0;
          return result;
        } catch {
          throw first;
        }
      }
    } catch {
      state.retryAt = Date.now() + 5000;
    }
  }

  const local = memoryCheck(key, limit, windowMs);
  return { ...local, driver: url ? "memory-fallback" : "memory" };
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
