// Fetch helpers: timeouts + SSRF guard for outbound calls (AI, webhooks).

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (e) {
    if ((e as Error)?.name === "AbortError") {
      throw new Error(`Request timed out after ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

/** Parse JSON safely with a size cap; throws a concise error on malformed output. */
export async function parseJsonSafe(res: Response, maxChars = 200_000): Promise<unknown> {
  const text = await res.text();
  if (text.length > maxChars) throw new Error("Response too large");
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response (preview: ${text.slice(0, 200)})`);
  }
}

/** Block private/loopback/link-local targets to prevent SSRF via webhook URLs. */
export function isBlockedWebhookUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return true;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return true;
  // Block loopback always (SSRF); dev can opt-in via ALLOW_LOCAL_WEBHOOKS=true.
  const host = u.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]") {
    return process.env.ALLOW_LOCAL_WEBHOOKS !== "true";
  }
  // IPv4 literals: block 10/8, 172.16/12, 192.168/16, 169.254/16, 0.0.0.0
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (v4) {
    const [, a, b] = v4.map(Number);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true;
    if (a === 0) return true;
  }
  if (host.endsWith(".internal") || host.endsWith(".local")) return true;
  if (u.username || u.password) return true;
  return false;
}
