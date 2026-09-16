import { registerResumeWorkers } from "./workers/resume-worker";

let bootstrapped = false;

/** Idempotent server bootstrap: registers background job handlers. */
export function ensureWorkers() {
  if (bootstrapped) return;
  bootstrapped = true;
  registerResumeWorkers();
}
