// Voice seams: STTProvider / TTSProvider / LLMProvider. Browser captures audio
// via MediaRecorder/getUserMedia; server exchanges transcripts. No hard dependency
// on any vendor — configure per deployment.
// STT: OPENAI_API_KEY (Whisper) > DEEPGRAM_API_KEY > passthrough.
// TTS: ELEVENLABS_API_KEY > OPENAI_API_KEY > passthrough.

import { fetchWithTimeout } from "@/lib/security/fetch";

export interface STTProvider {
  readonly name: string;
  transcribe(audio: Buffer, mimeType: string): Promise<{ text: string; confidence?: number }>;
}

export interface TTSProvider {
  readonly name: string;
  synthesize(text: string, voice?: string): Promise<{ audio: Buffer; mimeType: string }>;
}

export class PassthroughSTT implements STTProvider {
  readonly name = "passthrough";
  async transcribe(_audio: Buffer) {
    return { text: "", confidence: 0 };
  }
}

export class PassthroughTTS implements TTSProvider {
  readonly name = "passthrough";
  async synthesize(_text: string) {
    return { audio: Buffer.from(""), mimeType: "audio/mp3" };
  }
}

class OpenAIWhisperSTT implements STTProvider {
  readonly name = "openai-whisper";
  async transcribe(audio: Buffer, mimeType: string) {
    const key = process.env.OPENAI_API_KEY as string;
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType || "audio/webm" }), "audio.webm");
    form.append("model", process.env.OPENAI_STT_MODEL ?? "whisper-1");
    const res = await fetchWithTimeout("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: form as unknown as BodyInit,
    }, 30000);
    if (!res.ok) throw new Error(`whisper ${res.status}`);
    const data = await res.json() as { text?: string };
    return { text: data.text ?? "", confidence: 0.9 };
  }
}

class DeepgramSTT implements STTProvider {
  readonly name = "deepgram";
  async transcribe(audio: Buffer, mimeType: string) {
    const key = process.env.DEEPGRAM_API_KEY as string;
    const res = await fetchWithTimeout("https://api.deepgram.com/v1/listen?model=nova-2", {
      method: "POST",
      headers: { Authorization: `Token ${key}`, "Content-Type": mimeType || "audio/webm" },
      body: audio as unknown as BodyInit,
    }, 30000);
    if (!res.ok) throw new Error(`deepgram ${res.status}`);
    const data = await res.json() as { results?: { channels?: { alternatives?: { transcript?: string; confidence?: number }[] }[] } };
    const alt = data.results?.channels?.[0]?.alternatives?.[0];
    return { text: alt?.transcript ?? "", confidence: alt?.confidence ?? 0.8 };
  }
}

class OpenAITTS implements TTSProvider {
  readonly name = "openai-tts";
  async synthesize(text: string, voice?: string) {
    const key = process.env.OPENAI_API_KEY as string;
    const res = await fetchWithTimeout("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "tts-1", voice: voice ?? "alloy", input: text.slice(0, 4000) }),
    }, 30000);
    if (!res.ok) throw new Error(`tts ${res.status}`);
    return { audio: Buffer.from(await res.arrayBuffer()), mimeType: "audio/mp3" };
  }
}

class ElevenLabsTTS implements TTSProvider {
  readonly name = "elevenlabs";
  async synthesize(text: string, voice?: string) {
    const key = process.env.ELEVENLABS_API_KEY as string;
    const id = voice ?? process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
    const res = await fetchWithTimeout(`https://api.elevenlabs.io/v1/text-to-speech/${id}`, {
      method: "POST",
      headers: { "xi-api-key": key, "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 4000), model_id: "eleven_monolingual_v1" }),
    }, 30000);
    if (!res.ok) throw new Error(`elevenlabs ${res.status}`);
    return { audio: Buffer.from(await res.arrayBuffer()), mimeType: "audio/mp3" };
  }
}

export function getSTT(): STTProvider {
  if (process.env.OPENAI_API_KEY) return new OpenAIWhisperSTT();
  if (process.env.DEEPGRAM_API_KEY) return new DeepgramSTT();
  return new PassthroughSTT();
}

export function getTTS(): TTSProvider {
  if (process.env.ELEVENLABS_API_KEY) return new ElevenLabsTTS();
  if (process.env.OPENAI_API_KEY) return new OpenAITTS();
  return new PassthroughTTS();
}
