import { describe, it, expect } from "vitest";
import { validateResumeUpload, safeDownloadMime } from "@/lib/security/uploads";
import { generateSecureToken, hashToken, verifyTokenHash } from "@/lib/security/tokens";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { isBlockedWebhookUrl } from "@/lib/security/fetch";

describe("upload validation", () => {
  it("accepts a real PDF by magic bytes, rejects spoofed extension", () => {
    const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.from("a".repeat(100))]);
    expect(validateResumeUpload("cv.pdf", "application/pdf", pdf, 10_000).ok).toBe(true);
    // HTML masquerading as PDF must fail (magic mismatch)
    const html = Buffer.from("<html><script>alert(1)</script></html>");
    const r = validateResumeUpload("cv.pdf", "application/pdf", html, 10_000);
    expect(r.ok).toBe(false);
  });
  it("forces safe download mime", () => {
    expect(safeDownloadMime("text/html")).toBe("application/octet-stream");
    expect(safeDownloadMime("application/pdf")).toBe("application/pdf");
  });
});

describe("reset tokens", () => {
  it("hashes and verifies in constant time, never stores plaintext", () => {
    const t = generateSecureToken();
    expect(t.length).toBeGreaterThanOrEqual(64);
    const h = hashToken(t);
    expect(h).not.toContain(t);
    expect(verifyTokenHash(t, h)).toBe(true);
    expect(verifyTokenHash(t + "x", h)).toBe(false);
  });
});

describe("rate limiting", () => {
  it("blocks after limit", () => {
    const key = `test:${Date.now()}:${Math.random()}`;
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(true);
    expect(checkRateLimit(key, 2, 60_000).allowed).toBe(false);
  });
});

describe("webhook SSRF guard", () => {
  it("blocks internal targets, allows public https", () => {
    expect(isBlockedWebhookUrl("http://localhost:3000/hook")).toBe(true);
    expect(isBlockedWebhookUrl("http://192.168.1.5/x")).toBe(true);
    expect(isBlockedWebhookUrl("http://10.0.0.1/x")).toBe(true);
    expect(isBlockedWebhookUrl("ftp://example.com/x")).toBe(true);
    expect(isBlockedWebhookUrl("https://example.com/webhook")).toBe(false);
  });
});
