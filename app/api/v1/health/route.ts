import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getStorage } from "@/lib/storage/storage";
import { getQueueHealth } from "@/lib/queue/queue";

// Liveness + dependency checks for Docker HEALTHCHECK / uptime monitors.
// Always 200 with per-check status (never 500 on degraded — orchestrators
// distinguish via `ok:false`).
export async function GET(_req: NextRequest) {
  const checks: Record<string, { ok: boolean; latencyMs?: number; detail?: string }> = {};
  async function timed<T>(name: string, fn: () => Promise<T>) {
    const s = Date.now();
    try {
      await fn();
      checks[name] = { ok: true, latencyMs: Date.now() - s };
    } catch (e) {
      checks[name] = { ok: false, latencyMs: Date.now() - s, detail: e instanceof Error ? e.message.slice(0, 200) : "failed" };
    }
  }
  await timed("db", () => prisma.$queryRaw`SELECT 1`);
  await timed("queue", async () => {
    const h = await getQueueHealth();
    if (h.redisOk === false) throw new Error("redis unreachable");
  });
  await timed("storage", async () => {
    const p = (process.env.STORAGE_PROVIDER ?? "local").toLowerCase();
    if (p !== "local") {
      if (!process.env.S3_BUCKET || !process.env.S3_ACCESS_KEY) throw new Error("s3 env missing");
    }
  });
  const ok = checks.db?.ok !== false;
  return Response.json({ ok, version: process.env.npm_package_version ?? "0.1.0", checks, now: new Date().toISOString() }, { status: 200 });
}
