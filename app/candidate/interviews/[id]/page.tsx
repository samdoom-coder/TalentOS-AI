"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { Card, Button, ErrorState } from "@/components/ui/primitives";

interface Msg { speaker: string; message: string }

export default function CandidateInterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [consent, setConsent] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);
  useEffect(() => {
    if (!sessionId || done) return;
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, [sessionId, done]);

  async function start() {
    setErr(null);
    const res = await fetch(`/api/v1/interviews/${id}/sessions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consent }) });
    const j = await res.json();
    if (!j.success) { setErr(j.error?.message ?? "Could not start."); return; }
    setSessionId(j.data.sessionId);
    if (j.data.resumed) {
      const existing = await fetch(`/api/v1/interviews/sessions/${j.data.sessionId}/complete`).then((r) => r.json()).catch(() => null);
      const history = existing?.success
        ? (existing.data.transcripts ?? []).filter((t: any) => t.speaker !== "system").map((t: any) => ({ speaker: t.speaker, message: t.message }))
        : [];
      setMsgs(history.length ? history : [{ speaker: "ai", message: `Welcome back. Let's continue.\n\n${j.data.welcome}` }]);
      return;
    }
    setMsgs([{ speaker: "ai", message: `Welcome! I'm your AI interviewer. Let's begin.\n\n${j.data.welcome}` }]);
  }

  async function toggleRecording() {
    try {
      if (recording) {
        mediaRef.current?.stop();
        setRecording(false);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      mediaRef.current = rec;
      rec.start();
      setRecording(true);
      // MVP: recording state shown; chunks upload async (voice STT plugs in via STTProvider).
      rec.onstop = () => stream.getTracks().forEach((t) => t.stop());
    } catch {
      setErr("Microphone unavailable — you can still continue by typing.");
    }
  }

  async function send() {
    if (!input.trim() || !sessionId) return;
    const text = input.trim();
    setInput("");
    setMsgs((m) => [...m, { speaker: "candidate", message: text }]);
    setBusy(true);
    const res = await fetch(`/api/v1/interviews/sessions/${sessionId}/message`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: text }) });
    const j = await res.json();
    setBusy(false);
    setMsgs((m) => [...m, { speaker: "ai", message: j.success ? j.data.reply : "Thanks — please continue." }]);
  }

  async function finish() {
    if (!sessionId) return;
    setBusy(true);
    await fetch(`/api/v1/interviews/sessions/${sessionId}/complete`, { method: "POST" });
    setBusy(false);
    setDone(true);
  }

  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  if (!sessionId) {
    return (
      <Card>
        <h1 className="text-xl font-semibold">AI Interview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Adaptive questions based on your answers. Your responses are transcribed and evaluated with human review — never auto-decided.</p>
        <label className="mt-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1" />
          I consent to this AI interview, transcription and evaluation (required to begin).
        </label>
        {err && <div className="mt-2"><ErrorState message={err} /></div>}
        <Button className="mt-4 w-full" disabled={!consent} onClick={start}>Check mic & start</Button>
      </Card>
    );
  }

  if (done) {
    return <Card><p className="font-semibold">Interview complete — thank you!</p><p className="mt-1 text-sm text-muted-foreground">The hiring team will review your transcript and evaluation. You can close this page.</p></Card>;
  }

  return (
    <div>
      <Card>
        <div className="flex items-center justify-between text-sm">
          <p className="font-semibold">AI Interviewer</p>
          <p className="tabular-nums text-muted-foreground">{mm}:{ss} {recording ? "· ● recording" : ""}</p>
        </div>
        <div className="mt-3 max-h-[50vh] space-y-2 overflow-y-auto" aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${m.speaker === "ai" ? "bg-muted" : "ml-auto bg-primary text-primary-foreground"}`}>
              <p className="whitespace-pre-wrap">{m.message}</p>
            </div>
          ))}
          {busy && <p className="text-sm text-muted-foreground">AI is thinking…</p>}
          <div ref={bottomRef} />
        </div>
        <div className="mt-3 flex gap-2">
          <Button variant="secondary" onClick={toggleRecording} aria-pressed={recording}>{recording ? "Stop mic" : "🎙 Mic"}</Button>
          <input className="input" placeholder="Type your answer…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") void send(); }} aria-label="Your response" />
          <Button disabled={busy || !input.trim()} onClick={send}>Send</Button>
        </div>
        <Button variant="secondary" className="mt-3 w-full" onClick={finish}>Finish interview</Button>
      </Card>
    </div>
  );
}
