// Minimal Redis RESP client (no dependency) for the queue driver.
// Supports only what the queue needs: LPUSH, BRPOP, LLEN, PING.
// Falls back to in-process when REDIS_URL is unset or unreachable.

import net from "net";

function encode(...args: string[]): Buffer {
  let out = `*${args.length}\r\n`;
  for (const a of args) {
    const b = Buffer.byteLength(a);
    out += `$${b}\r\n${a}\r\n`;
  }
  return Buffer.from(out);
}

function parseReply(buf: Buffer): { value: unknown; rest: Buffer } {
  const str = buf.toString("utf8");
  const type = str[0];
  const crlf = str.indexOf("\r\n");
  if (crlf < 0) throw new Error("partial");
  const head = str.slice(1, crlf);
  const rest = buf.subarray(crlf + 2);
  if (type === "+") return { value: head, rest };
  if (type === "-") throw new Error(head);
  if (type === ":") return { value: Number(head), rest };
  if (type === "$") {
    const len = Number(head);
    if (len < 0) return { value: null, rest };
    if (rest.length < len + 2) throw new Error("partial");
    return { value: rest.subarray(0, len).toString("utf8"), rest: rest.subarray(len + 2) };
  }
  if (type === "*") {
    const n = Number(head);
    if (n < 0) return { value: null, rest };
    let cur = rest;
    const arr: unknown[] = [];
    for (let i = 0; i < n; i++) {
      const r = parseReply(cur);
      arr.push(r.value);
      cur = r.rest;
    }
    return { value: arr, rest: cur };
  }
  throw new Error("unknown reply");
}

export interface RedisConn {
  cmd(...args: string[]): Promise<unknown>;
  close(): void;
}

export function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  const u = new URL(url);
  const db = u.pathname && u.pathname !== "/" ? Number(u.pathname.slice(1)) || 0 : 0;
  return { host: u.hostname, port: Number(u.port) || 6379, password: u.password ? decodeURIComponent(u.password) : undefined, db };
}

export async function connectRedis(url: string, timeoutMs = 3000): Promise<RedisConn> {
  const { host, port, password } = parseRedisUrl(url);
  const socket = net.createConnection({ host, port });
  socket.setNoDelay(true);
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error("redis connect timeout")), timeoutMs);
    socket.once("connect", () => { clearTimeout(t); resolve(); });
    socket.once("error", (e) => { clearTimeout(t); reject(e); });
  });

  let pending: Buffer = Buffer.alloc(0);
  let failure: Error | null = null;
  const waiters: Array<{ resolve: (v: unknown) => void; reject: (e: Error) => void }> = [];

  function flush() {
    while (pending.length && waiters.length) {
      const waiter = waiters[0];
      try {
        const { value, rest } = parseReply(pending);
        pending = rest;
        waiters.shift();
        waiter.resolve(value);
      } catch (e) {
        if ((e as Error).message === "partial") return;
        waiters.shift();
        waiter.reject(e as Error);
      }
    }
  }

  function fail(error: Error) {
    failure = error;
    for (const w of waiters.splice(0)) w.reject(error);
  }

  socket.on("data", (d: Buffer) => {
    pending = Buffer.concat([pending, d]);
    flush();
  });
  socket.on("error", (e: Error) => fail(e));
  socket.on("close", () => fail(new Error("redis connection closed")));

  async function cmd(...args: string[]): Promise<unknown> {
    if (failure) throw failure;
    return new Promise((resolve, reject) => {
      waiters.push({ resolve, reject });
      socket.write(encode(...args));
      flush();
    });
  }

  if (password) await cmd("AUTH", password);
  await cmd("PING");
  return { cmd, close: () => socket.end() };
}
