import { SignJWT, jwtVerify } from "jose";

export function getAuthSecret(): Uint8Array {
  const raw = process.env.AUTH_SECRET;
  if (!raw || raw.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_SECRET is missing or too short (min 32 chars). Set a random 32+ char secret; refusing to boot."
      );
    }
    // Dev/test only fallback — never used in production (see guard above).
    return new TextEncoder().encode("dev-secret-change-me-min-32-chars-long!!");
  }
  return new TextEncoder().encode(raw);
}

export interface SessionPayload {
  sub: string; // userId
  email: string;
  name: string;
  orgId?: string;
  role?: string;
}

export async function signSession(payload: SessionPayload, expiresIn = "7d"): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getAuthSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = "talentos_session";
