import { randomBytes, createHash, timingSafeEqual } from "crypto";

/** Generate a URL-safe opaque token (e.g. password reset). */
export function generateSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString("hex");
}

/** SHA-256 hash for storing tokens (never store reset tokens in plaintext). */
export function hashToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Constant-time comparison of a presented token against a stored hash. */
export function verifyTokenHash(presented: string, storedHash: string): boolean {
  const candidate = hashToken(presented);
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Detect legacy plaintext tokens (64 hex chars created pre-hash are also hex,
 *  so callers should try hash-compare first, then fall back to direct compare
 *  once for migration and immediately re-hash). */
export function isHex64(s: string): boolean {
  return /^[0-9a-f]{64}$/i.test(s);
}
