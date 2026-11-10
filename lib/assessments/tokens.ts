import { SignJWT, jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/auth/jwt";

// Short-lived, signed tokens for candidate assessment access.
// - Invite: recruiter-generated, binds an assessment to a candidate.
// - Attempt: issued when an attempt starts, required to submit answers.
// Tokens are stateless so they work across instances without a DB round-trip;
// the attempt row remains the source of truth for status/expiry.

export interface AssessmentInvitePayload {
  typ: "assessment_invite";
  assessmentId: string;
  organizationId: string;
  candidateId: string;
  applicationId?: string;
  sub: string;
}

export interface AssessmentAttemptPayload {
  typ: "assessment_attempt";
  attemptId: string;
  assessmentId: string;
  candidateId?: string;
  sub: string;
}

export async function signAssessmentInvite(
  payload: Omit<AssessmentInvitePayload, "typ">,
  expiresIn = "7d"
): Promise<string> {
  return new SignJWT({ ...payload, typ: "assessment_invite" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getAuthSecret());
}

export async function verifyAssessmentInvite(token: string): Promise<AssessmentInvitePayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    if (payload.typ !== "assessment_invite" || typeof payload.assessmentId !== "string" || typeof payload.candidateId !== "string") {
      return null;
    }
    return payload as unknown as AssessmentInvitePayload;
  } catch {
    return null;
  }
}

export async function signAssessmentAttempt(
  payload: Omit<AssessmentAttemptPayload, "typ">,
  expiresIn = "24h"
): Promise<string> {
  return new SignJWT({ ...payload, typ: "assessment_attempt" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(getAuthSecret());
}

export async function verifyAssessmentAttempt(token: string): Promise<AssessmentAttemptPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getAuthSecret());
    if (payload.typ !== "assessment_attempt" || typeof payload.attemptId !== "string" || typeof payload.assessmentId !== "string") {
      return null;
    }
    return payload as unknown as AssessmentAttemptPayload;
  } catch {
    return null;
  }
}
