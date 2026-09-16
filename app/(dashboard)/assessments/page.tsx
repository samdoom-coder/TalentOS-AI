"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Badge, Button, EmptyState, Skeleton, ErrorState } from "@/components/ui/primitives";

export default function AssessmentsPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/assessments?orgId=${orgId}` : null);
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <PageHeader title="Assessments" subtitle="Build, assign and review practical evaluations." action={<Button onClick={() => setShowNew((v) => !v)}>+ New assessment</Button>} />
      {showNew && orgId && <AssessmentBuilder orgId={orgId} onDone={() => { setShowNew(false); reload(); }} />}
      {loading && <Skeleton className="h-32" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && !showNew && <EmptyState title="No assessments yet" body="Create an MCQ assessment or let AI draft questions from a job description." />}
      <div className="space-y-3">
        {data?.map((a: any) => (
          <Link key={a.id} href={`/assessments/${a.id}`}>
            <Card className="transition hover:shadow-md">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{a.title}</p>
                <div className="flex gap-1.5"><Badge>{a.sections?.reduce((n: number, s: any) => n + (s.questions?.length ?? 0), 0)} questions</Badge><Badge tone="blue">{a._count?.attempts ?? 0} attempts</Badge></div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{a.description ?? "—"}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function AssessmentBuilder({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [questions, setQuestions] = useState<{ type: string; prompt: string; options?: string[]; answerKey?: any; points: number }[]>([
    { type: "mcq", prompt: "", options: ["", ""], answerKey: { value: "" }, points: 1 },
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function aiDraft() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ draft: string }>(`/api/v1/assessments/generate`, { method: "POST", body: JSON.stringify({ jobDescription: jobDescription || title, organizationId: orgId, count: 5 }) });
      // Draft is free text; recruiter converts to structured questions (review gate).
      setQuestions([{ type: "long_answer", prompt: `AI draft (edit before publishing):\n${r.draft.slice(0, 500)}`, points: 1 }]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Draft failed");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    setBusy(true);
    try {
      await api(`/api/v1/assessments`, {
        method: "POST",
        body: JSON.stringify({
          organizationId: orgId, title, description: jobDescription || undefined, passingScore: 60,
          sections: [{ title: "Section 1", questions: questions.filter((q) => q.prompt.trim()).map((q) => ({ ...q, options: q.options?.filter(Boolean) })) }],
        }),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4 border-2">
      <p className="font-semibold">New assessment</p>
      {err && <div className="mt-2"><ErrorState message={err} /></div>}
      <div className="mt-3 space-y-3">
        <input className="input" placeholder="Assessment title, e.g. Frontend Screening" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Assessment title" />
        <div className="flex gap-2">
          <input className="input" placeholder="Role context for AI draft (optional)" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} aria-label="Role context" />
          <Button variant="secondary" disabled={busy || (!title && !jobDescription)} onClick={aiDraft}>AI draft</Button>
        </div>
        {questions.map((q, i) => (
          <div key={i} className="rounded-lg border p-3">
            <div className="flex gap-2">
              <select className="input w-40" value={q.type} onChange={(e) => { const n = [...questions]; n[i] = { ...n[i], type: e.target.value }; setQuestions(n); }} aria-label="Question type">
                <option value="mcq">MCQ</option><option value="multi_select">Multi-select</option><option value="true_false">True/False</option>
                <option value="short_answer">Short answer</option><option value="long_answer">Long answer</option><option value="coding">Coding</option><option value="scenario">Scenario</option>
              </select>
              <input className="input" placeholder="Question prompt" value={q.prompt} onChange={(e) => { const n = [...questions]; n[i] = { ...n[i], prompt: e.target.value }; setQuestions(n); }} aria-label={`Question ${i + 1}`} />
              <Button variant="secondary" onClick={() => setQuestions(questions.filter((_, x) => x !== i))}>✕</Button>
            </div>
            {q.type === "mcq" && (
              <div className="mt-2 grid gap-1">
                {(q.options ?? []).map((o, oi) => (
                  <input key={oi} className="input" placeholder={`Option ${oi + 1}`} value={o} onChange={(e) => { const n = [...questions]; const opts = [...(n[i].options ?? [])]; opts[oi] = e.target.value; n[i] = { ...n[i], options: opts, answerKey: { value: n[i].answerKey?.value } }; setQuestions(n); }} />
                ))}
                <div className="flex gap-2">
                  <Button variant="secondary" onClick={() => { const n = [...questions]; n[i] = { ...n[i], options: [...(n[i].options ?? []), ""] }; setQuestions(n); }}>+ Option</Button>
                  <input className="input" placeholder="Correct answer (must match an option)" value={q.answerKey?.value ?? ""} onChange={(e) => { const n = [...questions]; n[i] = { ...n[i], answerKey: { value: e.target.value } }; setQuestions(n); }} aria-label="Correct answer" />
                </div>
              </div>
            )}
          </div>
        ))}
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setQuestions([...questions, { type: "mcq", prompt: "", options: ["", ""], answerKey: { value: "" }, points: 1 }])}>+ Question</Button>
          <Button disabled={busy || !title || !questions.some((q) => q.prompt.trim())} onClick={save}>{busy ? "Saving…" : "Publish assessment"}</Button>
        </div>
      </div>
    </Card>
  );
}
