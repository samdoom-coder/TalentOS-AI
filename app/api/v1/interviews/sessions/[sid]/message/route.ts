import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { runAi } from "@/lib/ai/service";
import { getSession, getMembership } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest, { params }: { params: { sid: string } }) {
  try {
    const rl = await checkRateLimit(rateLimitKey(req, `interview:${params.sid}`), 20, 60_000);
    if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many messages. Slow down.", 429);
    const session = await getSession();
    if (!session) return errorResponse("UNAUTHORIZED", "Sign in to continue the interview.", 401);
    const { message } = z.object({ message: z.string().min(1).max(5000) }).parse(await req.json());
    const sessionRow = await prisma.interviewSession.findUnique({
      where: { id: params.sid },
      include: { interview: true, transcripts: { orderBy: { createdAt: "asc" }, take: 30 } },
    });
    if (!sessionRow) return errorResponse("NOT_FOUND", "Session not found.", 404);
    // Authorize: org staff (manage/conduct/view) OR the owning candidate (email match).
    let authorized = false;
    const membership = await getMembership(session.sub, sessionRow.interview.organizationId).catch(() => null);
    if (membership && (can(membership.role, "interviews:manage") || can(membership.role, "interviews:conduct") || can(membership.role, "candidates:view"))) {
      authorized = true;
    }
    if (!authorized && sessionRow.candidateId) {
      const cand = await prisma.candidate.findUnique({ where: { id: sessionRow.candidateId }, select: { email: true } }).catch(() => null);
      if (cand && cand.email.toLowerCase() === session.email.toLowerCase()) authorized = true;
    }
    if (!authorized) return errorResponse("FORBIDDEN", "Not authorized for this session.", 403);
    if (sessionRow.status !== "in_progress") return errorResponse("CONFLICT", "Session is not active.", 409);

    await prisma.interviewTranscript.create({ data: { sessionId: sessionRow.id, speaker: "candidate", message } });

    const history = sessionRow.transcripts.map((t) => `${t.speaker.toUpperCase()}: ${t.message}`).join("\n");
    const criteria = P<string[]>(sessionRow.interview.criteria, []).join(", ");
    let reply = "Thanks — can you go one level deeper on that with a concrete example and the outcome?";
    try {
      const r = await runAi({
        task: "interview_reply",
        userPrompt: `Role: ${sessionRow.interview.title}. Criteria: ${criteria}.\n\nConversation so far:\n${history.slice(-3000)}\nCANDIDATE: ${message}\n\nAsk ONE adaptive follow-up (probe vague claims, ask for specifics/metrics).`,
        organizationId: sessionRow.interview.organizationId,
        temperature: 0.6,
      });
      reply = r.text.trim() || reply;
    } catch {
      // keep fallback
    }
    await prisma.interviewTranscript.create({ data: { sessionId: sessionRow.id, speaker: "ai", message: reply } });
    return successResponse({ reply });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Message is required.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
