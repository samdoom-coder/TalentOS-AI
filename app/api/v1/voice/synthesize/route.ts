import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";
import { getTTS } from "@/lib/voice/voice";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

export async function POST(req: NextRequest) {
  const rl = checkRateLimit(rateLimitKey(req, "voice:tts"), 20, 60_000);
  if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many syntheses.", 429);
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
  try {
    const { text, voice } = z.object({ text: z.string().min(1).max(4000), voice: z.string().optional() }).parse(await req.json());
    const tts = getTTS();
    if (tts.name === "passthrough") return errorResponse("VALIDATION_ERROR", "Set ELEVENLABS_API_KEY or OPENAI_API_KEY for live TTS.", 400);
    const out = await tts.synthesize(text, voice);
    return new Response(new Uint8Array(out.audio), { headers: { "Content-Type": out.mimeType, "Cache-Control": "private, max-age=3600" } });
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid input.", 400, e.flatten());
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Synthesis failed.", 500);
  }
}
