// Standalone worker entry (docker `worker` service).
// Registers queue handlers, consumes Redis lists with BRPOP, and retries failed
// jobs through the shared queue module. Without REDIS_URL it stays alive for
// health but cannot receive jobs from another process (use dev in-process mode).

import { registerResumeWorkers } from "./lib/workers/resume-worker";
import "./lib/email/email";
import "./lib/webhooks/webhooks";
import { log } from "./lib/observability/logger";
import { connectRedis } from "./lib/queue/redis";
import { getQueueHealth, QUEUE_NAMES, runQueuedJob } from "./lib/queue/queue";

registerResumeWorkers();

const redisUrl = process.env.REDIS_URL;
let stopping = false;

async function consume() {
  if (!redisUrl) {
    log("warn", "worker started without REDIS_URL; no cross-process jobs to consume", { driver: "in-process" });
    return;
  }
  log("info", "worker consumer starting", { queues: QUEUE_NAMES.length });
  const keys = QUEUE_NAMES.map((q) => `talentos:${q}`);

  while (!stopping) {
    let conn: Awaited<ReturnType<typeof connectRedis>> | null = null;
    try {
      conn = await connectRedis(redisUrl, 5000);
      log("info", "worker connected to redis");
      while (!stopping) {
        // BRPOP blocks until a job arrives or the 5s timeout elapses.
        const res = (await conn.cmd("BRPOP", ...keys, "5")) as [string, string] | null;
        if (!res) continue;
        await runQueuedJob(res[1]);
      }
    } catch (e) {
      if (!stopping) {
        log("error", "worker redis loop failed; retrying", { error: e instanceof Error ? e.message : String(e) });
        await new Promise((r) => setTimeout(r, 2000));
      }
    } finally {
      conn?.close();
    }
  }
}

void consume();

setInterval(async () => {
  try {
    const h = await getQueueHealth();
    log("info", "worker heartbeat", h as unknown as Record<string, unknown>);
  } catch { /* ignore */ }
}, 60000);

process.on("SIGTERM", () => { stopping = true; process.exit(0); });
process.on("SIGINT", () => { stopping = true; process.exit(0); });
