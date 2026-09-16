// Voice seams: STTProvider / TTSProvider / LLMProvider. Browser captures audio
// via MediaRecorder/getUserMedia; server exchanges transcripts. No hard dependency
// on any vendor — configure per deployment.

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

export function getSTT(): STTProvider {
  return new PassthroughSTT(); // plug Deepgram/OpenAI/Azure here
}

export function getTTS(): TTSProvider {
  return new PassthroughTTS(); // plug ElevenLabs/OpenAI/Azure here
}
