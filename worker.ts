// Standalone worker entry (docker `worker` service).
// Registers all queue handlers and stays alive consuming Redis/in-process jobs.
// Run: `npx tsx worker.ts` (prod image bakes tsx via devDeps? use node --loader ts-node?).
// For minimal prod: `npm run worker`.

import { registerResumeWorkers } from "./lib/workers/resume-worker";
import "./lib/email/email";
import "./lib/webhooks/webhooks";
import { log } from "./lib/observability/logger";
import { getQueueHealth } from "./lib/queue/queue";

registerResumeWorkers();
log("info", "worker boot", { driver: process.env.REDIS_URL ? "redis" : "in-process" });

setInterval(async () => {
  try {
    const h = await getQueueHealth();
    log("info", "worker heartbeat", h as unknown as Record<string, unknown>);
  } catch { /* ignore */ }
}, 60000);

// Keep process alive; handlers run on setImmediate/setTimeout + Redis LPUSH log.
process.on("SIGTERM", () => process.exit(0));
