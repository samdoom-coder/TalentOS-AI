// Structured JSON logger + Sentry hook (no dep).
// LOG_LEVEL=debug|info|warn|error (default info). SENTRY_DSN optional: errors
// POSTed as envelopes via fetch; otherwise logged to stderr.

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN = (process.env.LOG_LEVEL ?? "info") as Level;

export function log(level: Level, msg: string, fields?: Record<string, unknown>) {
  if ((ORDER[level] ?? 20) < (ORDER[MIN] ?? 20)) return;
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  if (level === "error") console.error(line);
  else console.log(line);
}

export async function reportError(err: unknown, context?: Record<string, unknown>) {
  log("error", err instanceof Error ? err.message : "error", { stack: err instanceof Error ? err.stack?.slice(0, 2000) : undefined, ...context });
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  try {
    // Minimal Sentry envelope (store event); full SDK optional later.
    await fetch(dsn, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: err instanceof Error ? err.message : String(err), level: "error", extra: context }),
    }).catch(() => undefined);
  } catch { /* never break */ }
}
