import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { P } from "@/lib/db/json";
import { errorResponse, successResponse } from "@/lib/utils";
import { runAi } from "@/lib/ai/service";

export async function POST(req: NextRequest, { params }: { params: { sid: string } }) {
  try {
    const { message } = z.object({ message: z.string().min(1).max(5000) }).parse(await req.json());
    const session = await prisma.interviewSession.findUnique({
      where: { id: params.sid },
      include: { interview: true, transcripts: { orderBy: { createdAt: "asc" }, take: 30 } },
    });
    if (!session) return errorResponse("NOT_FOUND", "Session not found.", 404);
    if (session.status !== "in_progress") return errorResponse("CONFLICT", "Session is not active.", 409);

    await prisma.interviewTranscript.create({ data: { sessionId: session.id, speaker: "candidate", message } });

    const history = session.transcripts.map((t) => `${t.speaker.toUpperCase()}: ${t.message}`).join("\n");
    const criteria = P<string[]>(session.interview.criteria, []).join(", ");
    let reply = "Thanks — can you go one level deeper on that with a concrete example and the outcome?";
    try {
      const r = await runAi({
        task: "interview_reply",
        userPrompt: `Role: ${session.interview.title}. Criteria: ${criteria}.\n\nConversation so far:\n${history.slice(-3000)}\nCANDIDATE: ${message}\n\nAsk ONE adaptive follow-up (probe vague claims, ask for specifics/metrics).`,
        organizationId: session.interview.organizationId,
        temperature: 0.6,
      });
      reply = r.text.trim() || reply;
    } catch {
      // keep fallback
    }
    await prisma.interviewTranscript.create({ data: { sessionId: session.id, speaker: "ai", message: reply } });
    return successResponse({ reply });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Message is required.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}
