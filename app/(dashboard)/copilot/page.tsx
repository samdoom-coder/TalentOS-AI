"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe } from "@/lib/client";
import { Card, PageHeader, Button, EmptyState, ErrorState, Skeleton, Badge } from "@/components/ui/primitives";

interface Msg { role: "user" | "assistant"; content: string }
interface Evidence {
  searchCandidates?: { id: string; name: string; title: string | null; stage: string; matchScore: number | null; skills: string[]; href: string }[];
  getAnalytics?: { applications: number; hired: number; conversionPct: number; waitingReview: number; byStage: { stage: string; count: number }[] };
}

const QUICK = [
  "Show me candidates waiting for review",
  "Find React candidates",
  "Show funnel analytics",
  "Draft an interview invitation email",
];

export default function CopilotPage() {
  const { orgId } = useMe();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [evidence, setEvidence] = useState<Evidence | null>(null);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || !orgId || loading) return;
    setError(null);
    setLoading(true);
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    try {
      const res = await fetch("/api/v1/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: orgId, message: q }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error?.message ?? "Copilot failed");
      setMessages((m) => [...m, { role: "assistant", content: j.data.reply }]);
      setEvidence((j.data.evidence as Evidence) ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Copilot failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Recruiter Copilot" subtitle="Ask in plain English — answers use only your organization's data, with evidence and links." />
      {!messages.length && !loading && (
        <EmptyState
          title="What can I help with?"
          body="Try: candidates waiting for review, summarize a candidate, missing requirements, funnel analytics, or draft an invitation."
          action={<div className="flex flex-wrap justify-center gap-2">{QUICK.map((q) => (
            <button key={q} className="btn-secondary" onClick={() => ask(q)} disabled={!orgId}>{q}</button>
          ))}</div>}
        />
      )}
      <div className="space-y-3" aria-live="polite">
        {messages.map((m, i) => (
          <Card key={i} className={m.role === "user" ? "border-primary/30 bg-primary/5" : ""}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{m.role === "user" ? "You" : "Copilot · AI-generated"}</p>
            <p className="whitespace-pre-wrap text-sm">{m.content}</p>
          </Card>
        ))}
        {loading && <Skeleton className="h-24" />}
      </div>
      {error && <div className="mt-3"><ErrorState message={error} onRetry={() => messages.length && ask(messages.filter((m) => m.role === "user").slice(-1)[0]?.content ?? "")} /></div>}
      {evidence?.searchCandidates && evidence.searchCandidates.length > 0 && (
        <Card className="mt-4">
          <p className="font-semibold">Evidence — candidates</p>
          <ul className="mt-2 space-y-2">
            {evidence.searchCandidates.slice(0, 5).map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span><Link href={c.href} className="font-medium hover:underline">{c.name}</Link>
                  <span className="text-muted-foreground"> · {(c.stage ?? "").replace("_", " ")}{c.matchScore != null ? ` · ${c.matchScore}%` : ""}</span></span>
                <span className="flex gap-1">{(c.skills ?? []).slice(0, 3).map((s) => <Badge key={s}>{s}</Badge>)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {evidence?.getAnalytics && (
        <Card className="mt-4">
          <p className="font-semibold">Evidence — pipeline</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {evidence.getAnalytics.applications} applications · {evidence.getAnalytics.waitingReview} waiting review · {evidence.getAnalytics.hired} hired ({evidence.getAnalytics.conversionPct}%)
            {" · "}<Link href="/analytics" className="underline">Open analytics</Link>
          </p>
        </Card>
      )}
      <form className="sticky bottom-0 mt-4 flex gap-2 bg-background py-3" onSubmit={(e) => { e.preventDefault(); ask(input); }}>
        <input
          className="input flex-1" value={input} onChange={(e) => setInput(e.target.value)}
          placeholder={orgId ? "Ask Copilot… e.g. Show me candidates waiting for review" : "Sign in to an organization to use Copilot"}
          aria-label="Ask Copilot" disabled={!orgId || loading} maxLength={2000}
        />
        <Button type="submit" disabled={!orgId || loading || !input.trim()}>{loading ? "Thinking…" : "Ask"}</Button>
      </form>
      <p className="pb-4 text-xs text-muted-foreground">Copilot never auto-sends or auto-rejects. Drafts open in Messages; stage moves and interview scheduling always need your confirmation.</p>
    </div>
  );
}
