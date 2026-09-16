// Background job abstraction. Interface mirrors BullMQ (Redis) so production can
// swap InProcessQueue for a BullMQQueue without touching callers.
// Queues: resume-processing | ai-processing | email | notifications | video-processing | assessment-processing | analytics | webhooks

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
  // Process asynchronously (in-process dev driver). Production: BullMQ worker.
  setImmediate(() => void process(job.id));
  return job;
}

async function process(id: string) {
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
      setTimeout(() => void process(id), 1000 * job.attempts);
    } else {
      job.status = "failed";
    }
  }
}

export function getJob(id: string) {
  return jobs.get(id);
}
