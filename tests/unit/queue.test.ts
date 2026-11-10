import { describe, it, expect } from "vitest";
import { registerHandler, runQueuedJob, getJob } from "@/lib/queue/queue";
import { parseRedisUrl } from "@/lib/queue/redis";

describe("redis connection URLs", () => {
  it("parses credentials and database selection", () => {
    expect(parseRedisUrl("redis://user:p%40ss@example.com:6380/2")).toEqual({
      host: "example.com",
      port: 6380,
      username: "user",
      password: "p@ss",
      db: 2,
    });
    expect(parseRedisUrl("redis://localhost")).toMatchObject({
      host: "localhost",
      port: 6379,
      username: undefined,
      password: undefined,
      db: 0,
    });
  });
});

describe("redis queue consumer", () => {
  it("executes a serialized job through its registered handler", async () => {
    let seen: unknown = null;
    registerHandler("analytics", "test-consume", async (job) => {
      seen = job.payload;
    });
    const id = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    await runQueuedJob(
      JSON.stringify({
        id,
        queue: "analytics",
        name: "test-consume",
        payload: { value: 42 },
        attempts: 0,
        maxAttempts: 2,
        createdAt: new Date().toISOString(),
      })
    );
    expect(seen).toEqual({ value: 42 });
    expect(getJob(id)?.status).toBe("completed");
  });

  it("ignores malformed or unknown queue messages", async () => {
    await runQueuedJob("not json");
    await runQueuedJob(JSON.stringify({ id: "x", queue: "unknown", name: "nope" }));
    expect(getJob("x")).toBeUndefined();
  });

  it("marks jobs failed when no handler is registered", async () => {
    const id = `missing-${Date.now()}`;
    await runQueuedJob(
      JSON.stringify({
        id,
        queue: "analytics",
        name: "no-such-handler",
        payload: {},
        attempts: 0,
        maxAttempts: 1,
        createdAt: new Date().toISOString(),
      })
    );
    expect(getJob(id)?.status).toBe("failed");
  });
});
