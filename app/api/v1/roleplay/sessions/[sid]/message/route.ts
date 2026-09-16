import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { runAi } from "@/lib/ai/service";

export async function POST(req: NextRequest, { params }: { params: { sid: string } }) {
  try {
    const { message } = z.object({ message: z.string().min(1).max(3000) }).parse(await req.json());
    const rs = await prisma.roleplaySession.findUnique({ where: { id: params.sid }, include: { scenario: true, messages: { orderBy: { createdAt: "asc" }, take: 20 } } });
    if (!rs) return errorResponse("NOT_FOUND", "Session not found.", 404);
    await prisma.roleplayMessage.create({ data: { sessionId: rs.id, speaker: "candidate", message } });
    const history = rs.messages.map((m) => `${m.speaker}: ${m.message}`).join("\n");
    let reply = "Understood — and what would you do if that didn't work?";
    try {
      const r = await runAi({
        task: "roleplay_reply",
        userPrompt: `You are: ${rs.scenario.persona}. Scenario: ${rs.scenario.scenario}.\n\nHistory:\n${history.slice(-2500)}\nCandidate: ${message}\n\nReply in character, under 60 words.`,
        temperature: 0.7,
      });
      reply = r.text.trim() || reply;
    } catch { /* fallback */ }
    await prisma.roleplayMessage.create({ data: { sessionId: rs.id, speaker: "ai", message: reply } });
    return successResponse({ reply });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Message required.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", 500);
  }
}

export async function GET(_req: NextRequest, { params }: { params: { sid: string } }) {
  const rs = await prisma.roleplaySession.findUnique({ where: { id: params.sid }, include: { messages: { orderBy: { createdAt: "asc" } }, evaluations: true, scenario: true } });
  if (!rs) return errorResponse("NOT_FOUND", "Session not found.", 404);
  return successResponse(rs);
}
