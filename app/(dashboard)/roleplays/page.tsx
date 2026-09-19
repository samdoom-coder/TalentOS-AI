"use client";

import { useState } from "react";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Badge, Button, EmptyState, Skeleton, ErrorState, toast } from "@/components/ui/primitives";

const PRESETS = ["Sales Call", "Customer Support", "Manager Conflict", "Negotiation", "Client Presentation", "Incident Response", "Product Demo"];

export default function RoleplaysPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/roleplay/scenarios?orgId=${orgId}` : null);
  const [form, setForm] = useState({ title: "Sales Call", persona: "Skeptical enterprise buyer", scenario: "Candidate must discover needs, handle a pricing objection, and agree a next step.", objectives: "Discover needs, Handle objection, Agree next step" });
  const [runner, setRunner] = useState<{ sessionId: string; opener: string } | null>(null);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<{ speaker: string; message: string }[]>([]);
  const [evals, setEvals] = useState<any[] | null>(null);

  async function create() {
    try {
      await api(`/api/v1/roleplay/scenarios`, {
        method: "POST",
        body: JSON.stringify({ organizationId: orgId, title: form.title, persona: form.persona, scenario: form.scenario, objectives: form.objectives.split(",").map((s) => s.trim()).filter(Boolean) }),
      });
      toast("Scenario created");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function start(scenarioId: string) {
    try {
      setEvals(null);
      setChat([]);
      const r = await api<{ sessionId: string; opener: string }>(`/api/v1/roleplay/scenarios`, {
        method: "POST",
        body: JSON.stringify({ organizationId: orgId, action: "start", scenarioId, title: "Try run", persona: "Counterpart persona", scenario: "Brief for try-run session" }),
      });
      setRunner(r);
      setChat([{ speaker: "ai", message: r.opener }]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Start failed");
    }
  }

  async function send() {
    if (!runner || !msg.trim()) return;
    const text = msg;
    setMsg("");
    setChat((c) => [...c, { speaker: "candidate", message: text }]);
    try {
      const r = await api<{ reply: string }>(`/api/v1/roleplay/sessions/${runner.sessionId}/message`, { method: "POST", body: JSON.stringify({ message: text }) });
      setChat((c) => [...c, { speaker: "ai", message: r.reply }]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Reply failed");
    }
  }

  async function evaluate(scenarioId: string, sessionId: string) {
    try {
      const r = await api<{ evaluations: any[] }>(`/api/v1/roleplay/scenarios`, {
        method: "POST",
        body: JSON.stringify({ organizationId: orgId, action: "evaluate", scenarioId: sessionId, title: "Evaluate run", persona: "Counterpart persona", scenario: "Brief for evaluation run" }),
      });
      setEvals(r.evaluations);
      toast(r.evaluations.length ? "Evaluated" : "No evaluation (AI unavailable)");
      void scenarioId;
    } catch (e) {
      toast(e instanceof Error ? e.message : "Evaluate failed");
    }
  }

  return (
    <div>
      <PageHeader title="Role Plays" subtitle="Scenario-based evaluation — AI plays the counterpart." />
      <Card className="mb-4">
        <p className="font-semibold">New scenario</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <select className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Scenario preset">
            {PRESETS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input className="input" value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} aria-label="Persona" />
          <input className="input md:col-span-2" value={form.scenario} onChange={(e) => setForm({ ...form, scenario: e.target.value })} aria-label="Scenario brief" />
          <input className="input md:col-span-2" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} aria-label="Objectives, comma separated" />
        </div>
        <Button className="mt-3" onClick={create}>Create scenario</Button>
      </Card>
      {loading && <Skeleton className="h-24" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No scenarios yet" body="Create a sales call, support case or negotiation to evaluate soft skills." />}
      <div className="space-y-3">
        {data?.map((s: any) => (
          <Card key={s.id}>
            <div className="flex items-center justify-between"><p className="font-semibold">{s.title}</p><Badge>{s.sessions?.length ?? 0} sessions</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">Persona: {s.persona}</p>
            <p className="mt-1 text-sm">{s.scenario}</p>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => start(s.id)}>Try session</Button>
              {runner && <Button variant="secondary" onClick={() => evaluate(s.id, runner.sessionId)}>Evaluate last run</Button>}
            </div>
          </Card>
        ))}
      </div>
      {runner && (
        <Card className="mt-4">
          <p className="font-semibold">Live try-run <span className="text-xs text-muted-foreground">({runner.sessionId.slice(0, 8)})</span></p>
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto rounded-lg border p-3" aria-live="polite">
            {chat.map((m, i) => (
              <p key={i} className={m.speaker === "ai" ? "text-sm" : "text-sm font-medium"}><span className="text-muted-foreground">{m.speaker}:</span> {m.message}</p>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <input className="input" value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Reply as candidate…" aria-label="Candidate reply" />
            <Button onClick={send}>Send</Button>
          </div>
          {evals && (
            <ul className="mt-3 space-y-1 text-sm">
              {evals.map((e: any, i: number) => <li key={i}><span className="font-medium">{e.name}:</span> {e.score} <span className="text-muted-foreground">({e.confidence}) — {(e.evidence ?? []).join(" ").slice(0, 160)}</span></li>)}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
