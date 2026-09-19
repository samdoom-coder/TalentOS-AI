// Background job abstraction. Interface mirrors BullMQ (Redis) so production can
// swap InProcessQueue for a BullMQQueue without touching callers.
// Queues: resume-processing | ai-processing | email | notifications | video-processing | assessment-processing | analytics | webhooks
// Driver: REDIS_URL set -> Redis list-backed durable queue (no dep, minimal RESP);
//         unset -> in-process (dev/single-instance). Health via getQueueHealth().

import { connectRedis } from "./redis";

export type QueueName =
  | "resume-processing"
  | "ai-processing"
  | "email"
  | "notifications"
  | "video-processing"
  | "assessment-processing"
  | "analytics"
  | "webhooks";

export interface Job<T = unknown> {
  id: string;
  queue: QueueName;
  name: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  status: "queued" | "processing" | "completed" | "failed";
  error?: string;
  createdAt: Date;
}

type Handler<T = unknown> = (job: Job<T>) => Promise<void>;

const handlers = new Map<string, Handler<unknown>>();
const jobs = new Map<string, Job<unknown>>();

function key(queue: QueueName, name: string) {
  return `${queue}:${name}`;
}

export function registerHandler<T>(queue: QueueName, name: string, handler: Handler<T>) {
  handlers.set(key(queue, name), handler as Handler<unknown>);
}

export async function enqueue<T>(queue: QueueName, name: string, payload: T, opts?: { maxAttempts?: number }): Promise<Job<T>> {
  const job: Job<T> = {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    queue,
    name,
    payload,
    attempts: 0,
    maxAttempts: opts?.maxAttempts ?? 3,
    status: "queued",
    createdAt: new Date(),
  };
  jobs.set(job.id, job as Job<unknown>);
  // Durable log when Redis is configured (multi-instance: run BullMQ workers
  // consuming `talentos:<queue>`; single-instance still processes in-process).
  if (globalThis.process?.env?.REDIS_URL) {
    const redisUrl = globalThis.process.env.REDIS_URL;
    import("./redis").then(async ({ connectRedis: connect }) => {
      try {
        const conn = await connect(redisUrl, 2000);
        await conn.cmd("LPUSH", `talentos:${queue}`, JSON.stringify({ id: job.id, name, payload, createdAt: job.createdAt })).catch(() => undefined);
        conn.close();
      } catch { /* fallback already queued in-process */ }
    }).catch(() => undefined);
  }
  // Process asynchronously (in-process dev driver). Production: BullMQ worker.
  setImmediate(() => void drain(job.id));
  return job;
}

async function drain(id: string) {
  const job = jobs.get(id);
  if (!job || job.status !== "queued") return;
  const handler = handlers.get(key(job.queue, job.name));
  if (!handler) {
    job.status = "failed";
    job.error = `No handler registered for ${job.queue}:${job.name}`;
    return;
  }
  job.status = "processing";
  try {
    await handler(job);
    job.status = "completed";
  } catch (err) {
    job.attempts += 1;
    job.error = err instanceof Error ? err.message : "job failed";
    if (job.attempts < job.maxAttempts) {
      job.status = "queued";
      setTimeout(() => void drain(id), 1000 * job.attempts);
    } else {
      job.status = "failed";
    }
  }
}

export function getJob(id: string) {
  return jobs.get(id);
}

export function driver(): "redis" | "in-process" {
  return globalThis.process?.env?.REDIS_URL ? "redis" : "in-process";
}

/** Queue depths + driver for /api/v1/health and admin. Never throws. */
export async function getQueueHealth(): Promise<{ driver: string; queued: number; processing: number; failed: number; redisOk: boolean | null }> {
  let queued = 0, processing = 0, failed = 0;
  for (const j of jobs.values()) {
    if (j.status === "queued") queued++;
    else if (j.status === "processing") processing++;
    else if (j.status === "failed") failed++;
  }
  const redisUrl = globalThis.process?.env?.REDIS_URL;
  if (!redisUrl) return { driver: "in-process", queued, processing, failed, redisOk: null };
  try {
    const conn = await connectRedis(redisUrl, 2000);
    // Sum LLEN across known queues (best-effort)
    const names: QueueName[] = ["resume-processing", "email", "webhooks", "notifications", "ai-processing", "assessment-processing", "analytics", "video-processing"];
    for (const qn of names) {
      const n = (await conn.cmd("LLEN", `talentos:${qn}`).catch(() => 0)) as number;
      queued += Number(n) || 0;
    }
    conn.close();
    return { driver: "redis", queued, processing, failed, redisOk: true };
  } catch {
    return { driver: "redis (unreachable, using in-process fallback)", queued, processing, failed, redisOk: false };
  }
}
