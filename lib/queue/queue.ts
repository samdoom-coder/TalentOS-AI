// Background job abstraction. Durable list-backed Redis queue when REDIS_URL is
// set (the standalone worker consumes it); in-process driver for local dev.
// Queues: resume-processing | ai-processing | email | notifications | video-processing | assessment-processing | analytics | webhooks
//
// Web instances only produce when Redis is configured. The worker consumes via
// BRPOP and this module owns handler lookup, retries and status tracking.

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

export const QUEUE_NAMES: QueueName[] = [
  "resume-processing",
  "ai-processing",
  "email",
  "notifications",
  "video-processing",
  "assessment-processing",
  "analytics",
  "webhooks",
];

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

function redisUrl() {
  return globalThis.process?.env?.REDIS_URL || "";
}

function shouldDrainInProcess() {
  return !redisUrl() || globalThis.process?.env?.QUEUE_CONSUMER === "in-process";
}

function serialize(job: Job<unknown>) {
  return JSON.stringify({
    id: job.id,
    queue: job.queue,
    name: job.name,
    payload: job.payload,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    createdAt: job.createdAt.toISOString(),
  });
}

async function pushToRedis(queue: QueueName, job: Job<unknown>) {
  const url = redisUrl();
  if (!url) return;
  try {
    const conn = await connectRedis(url, 2000);
    await conn.cmd("LPUSH", `talentos:${queue}`, serialize(job));
    conn.close();
  } catch {
    // The in-process fallback only exists in single-instance/dev setups.
    if (shouldDrainInProcess()) setImmediate(() => void drain(job.id));
  }
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

  if (redisUrl()) {
    await pushToRedis(queue, job as Job<unknown>);
    // Producers must not also process when a standalone worker is running.
    if (shouldDrainInProcess()) setImmediate(() => void drain(job.id));
  } else {
    setImmediate(() => void drain(job.id));
  }
  return job;
}

async function execute(job: Job<unknown>) {
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
    job.error = undefined;
  } catch (err) {
    job.attempts += 1;
    job.error = err instanceof Error ? err.message : "job failed";
    if (job.attempts < job.maxAttempts) {
      job.status = "queued";
      if (redisUrl()) {
        await pushToRedis(job.queue, job);
      } else {
        setTimeout(() => void drain(job.id), 1000 * job.attempts);
      }
    } else {
      job.status = "failed";
    }
  }
}

async function drain(id: string) {
  const job = jobs.get(id);
  if (!job || job.status !== "queued") return;
  await execute(job);
}

/**
 * Consume one serialized job from Redis. Called by worker.ts after BRPOP.
 * Envelopes are validated before any handler runs.
 */
export async function runQueuedJob(raw: string): Promise<void> {
  let envelope: {
    id?: unknown;
    queue?: unknown;
    name?: unknown;
    payload?: unknown;
    attempts?: unknown;
    maxAttempts?: unknown;
    createdAt?: unknown;
  };
  try {
    envelope = JSON.parse(raw);
  } catch {
    return;
  }
  if (
    typeof envelope.id !== "string" ||
    typeof envelope.queue !== "string" ||
    !QUEUE_NAMES.includes(envelope.queue as QueueName) ||
    typeof envelope.name !== "string"
  ) {
    return;
  }
  const job: Job<unknown> = {
    id: envelope.id,
    queue: envelope.queue as QueueName,
    name: envelope.name,
    payload: envelope.payload,
    attempts: typeof envelope.attempts === "number" ? envelope.attempts : 0,
    maxAttempts: typeof envelope.maxAttempts === "number" ? envelope.maxAttempts : 3,
    status: "queued",
    createdAt:
      typeof envelope.createdAt === "string" && !Number.isNaN(Date.parse(envelope.createdAt))
        ? new Date(envelope.createdAt)
        : new Date(),
  };
  jobs.set(job.id, job);
  await execute(job);
}

export function getJob(id: string) {
  return jobs.get(id);
}

export function driver(): "redis" | "in-process" {
  return redisUrl() ? "redis" : "in-process";
}

/** Queue depths + driver for /api/v1/health and admin. Never throws. */
export async function getQueueHealth(): Promise<{ driver: string; queued: number; processing: number; failed: number; redisOk: boolean | null }> {
  let queued = 0, processing = 0, failed = 0;
  if (!redisUrl()) {
    for (const j of jobs.values()) {
      if (j.status === "queued") queued++;
      else if (j.status === "processing") processing++;
      else if (j.status === "failed") failed++;
    }
    return { driver: "in-process", queued, processing, failed, redisOk: null };
  }
  try {
    const conn = await connectRedis(redisUrl(), 2000);
    for (const qn of QUEUE_NAMES) {
      const n = (await conn.cmd("LLEN", `talentos:${qn}`).catch(() => 0)) as number;
      queued += Number(n) || 0;
    }
    conn.close();
    // Local status is only meaningful in the consumer process.
    for (const j of jobs.values()) {
      if (j.status === "processing") processing++;
      else if (j.status === "failed") failed++;
    }
    return { driver: "redis", queued, processing, failed, redisOk: true };
  } catch {
    return { driver: "redis (unreachable, using in-process fallback)", queued, processing, failed, redisOk: false };
  }
}
