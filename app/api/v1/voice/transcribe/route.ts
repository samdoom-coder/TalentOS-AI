import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";
import { getSTT } from "@/lib/voice/voice";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";

// POST multipart {audio: File} -> {text, provider}
export async function POST(req: NextRequest) {
  const rl = await checkRateLimit(rateLimitKey(req, "voice:stt"), 20, 60_000);
  if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many transcriptions.", 429);
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
  try {
    const form = await req.formData();
    const f = form.get("audio");
    if (!(f instanceof File) || !f.size) return errorResponse("VALIDATION_ERROR", "audio file required.", 400);
    if (f.size > 15 * 1024 * 1024) return errorResponse("VALIDATION_ERROR", "Audio under 15MB.", 400);
    const buf = Buffer.from(await f.arrayBuffer());
    const stt = getSTT();
    if (stt.name === "passthrough") {
      return successResponse({ text: "", provider: "passthrough", note: "Set OPENAI_API_KEY or DEEPGRAM_API_KEY for live STT." });
    }
    const out = await stt.transcribe(buf, f.type || "audio/webm");
    return successResponse({ text: out.text, confidence: out.confidence, provider: stt.name });
  } catch (e) {
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Transcription failed.", 500);
  }
}
