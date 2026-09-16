"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useApi, api } from "@/lib/client";
import { Card, PageHeader, Badge, Button, Skeleton, ErrorState, ScoreBar } from "@/components/ui/primitives";

const TABS = ["Overview", "Resume", "Experience", "Assessments", "Interviews", "Feedback", "Activity"] as const;

export default function CandidateDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: c, loading, error, reload } = useApi<any>(`/api/v1/candidates/${id}`);
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [note, setNote] = useState("");
  const [matching, setMatching] = useState(false);

  async function move(toStage: string) {
    const app = c?.applications?.[0];
    if (!app) return;
    await api(`/api/v1/applications/${app.id}/move`, { method: "POST", body: JSON.stringify({ applicationId: app.id, toStage, note: note || undefined }) });
    setNote("");
    reload();
  }

  async function runMatch() {
    const app = c?.applications?.[0];
    if (!app) return;
    setMatching(true);
    try {
      await api(`/api/v1/match`, { method: "POST", body: JSON.stringify({ jobId: app.jobId, candidateId: c.id }) });
      reload();
    } finally {
      setMatching(false);
    }
  }

  async function addFeedback() {
    const app = c?.applications?.[0];
    if (!app || !note.trim()) return;
    await api(`/api/v1/feedback`, { method: "POST", body: JSON.stringify({ applicationId: app.id, body: note }) });
    setNote("");
    reload();
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-64" /></div>;
  if (error || !c) return <ErrorState message={error ?? "Candidate not found."} onRetry={reload} />;

  const app = c.applications?.[0];
  const scores = c.scores ?? [];

  return (
    <div>
      <PageHeader
        title={c.name}
        subtitle={`${c.title ?? "Candidate"} · ${c.location ?? "—"} · ${c.experienceYrs ?? 0}y exp · ${app ? `Stage: ${app.stage.replace("_", " ")}` : "Talent pool"}`}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={runMatch} disabled={!app || matching}>{matching ? "Matching…" : "Run AI match"}</Button>
            <Button variant="secondary" onClick={() => {
              const blob = new Blob([JSON.stringify(c, null, 2)], { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `candidate-${c.id}.json`;
              a.click();
            }}>Export JSON</Button>
          </div>
        }
      />

      {app?.matchScore != null && (
        <Card className="mb-4">
          <p className="text-sm font-semibold">Overall match · {app.matchScore}% <span className="font-normal text-muted-foreground">(AI-generated, human review required)</span></p>
          <ScoreBar score={app.matchScore} className="mt-2 max-w-md" />
        </Card>
      )}

      <div className="mb-4 flex flex-wrap gap-1" role="tablist" aria-label="Candidate sections">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{t}</button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="font-semibold">AI summary</p>
            <p className="mt-2 text-sm text-muted-foreground">{c.summary ?? "No summary yet — run AI match after resume processing completes."}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {(c.skills ?? []).map((s: any) => <span key={s.id} className="badge bg-muted">{s.skill}</span>)}
            </div>
          </Card>
          <Card>
            <p className="font-semibold">Job-match evidence</p>
            {(c.evidence ?? []).length === 0 && <p className="mt-2 text-sm text-muted-foreground">No evaluations yet.</p>}
            <ul className="mt-2 space-y-3">
              {(c.evidence ?? []).map((e: any) => (
                <li key={e.id} className="text-sm">
                  <div className="flex items-center justify-between"><span className="font-medium">{e.requirement}</span><Badge tone={e.score != null && e.score >= 70 ? "green" : e.score != null && e.score >= 40 ? "amber" : "red"}>{e.score ?? "—"}</Badge></div>
                  <p className="mt-1 text-muted-foreground">“{e.evidence}”</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Source: {e.source} · Confidence: {e.confidence}</p>
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <p className="font-semibold">Move stage / add note</p>
            <div className="mt-2 flex gap-2">
              <select id="move" className="input" defaultValue={app?.stage ?? "applied"} onChange={(e) => move(e.target.value)} disabled={!app}>
                {["applied", "screening", "assessment", "interview", "technical_interview", "final_interview", "offer", "hired", "rejected"].map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
              </select>
            </div>
            <textarea className="input mt-2 h-auto" rows={2} placeholder="Add a note or @mention a teammate…" value={note} onChange={(e) => setNote(e.target.value)} aria-label="Recruiter note" />
            <Button variant="secondary" className="mt-2" onClick={addFeedback} disabled={!note.trim()}>Save feedback</Button>
          </Card>
          <Card>
            <p className="font-semibold">Scores</p>
            <ul className="mt-2 space-y-2">
              {scores.map((s: any) => (
                <li key={s.id} className="text-sm"><div className="flex justify-between"><span className="capitalize">{s.scope}</span><span className="font-medium">{s.score}</span></div><ScoreBar score={s.score} className="mt-1" /></li>
              ))}
              {!scores.length && <p className="text-sm text-muted-foreground">No scores yet.</p>}
            </ul>
          </Card>
        </div>
      )}

      {tab === "Resume" && (
        <Card>
          <p className="font-semibold">Documents</p>
          <ul className="mt-2 space-y-1 text-sm">
            {(c.documents ?? []).map((d: any) => <li key={d.id}>{d.fileName} · {d.kind}</li>)}
            {!c.documents?.length && <p className="text-muted-foreground">No documents.</p>}
          </ul>
        </Card>
      )}

      {tab === "Experience" && (
        <Card>
          <ul className="space-y-3">
            {(c.experience ?? []).map((e: any) => (
              <li key={e.id} className="text-sm"><p className="font-medium">{e.role} — {e.company}</p><p className="text-muted-foreground">{e.description}</p></li>
            ))}
            {!c.experience?.length && <p className="text-sm text-muted-foreground">No experience parsed yet.</p>}
          </ul>
        </Card>
      )}

      {tab === "Assessments" && <Card><p className="text-sm text-muted-foreground">Assessment attempts for this candidate appear on the assessment detail pages.</p></Card>}
      {tab === "Interviews" && <Card><p className="text-sm text-muted-foreground">Interview sessions and transcripts appear on the interview detail pages.</p></Card>}

      {tab === "Feedback" && (
        <Card>
          <ul className="space-y-2">
            {(app?.feedback ?? []).map((f: any) => <li key={f.id} className="rounded-lg bg-muted p-3 text-sm">{f.body}{f.rating ? ` · ★${f.rating}` : ""}</li>)}
            {!app?.feedback?.length && <p className="text-sm text-muted-foreground">No feedback yet — internal only, never shown to candidates.</p>}
          </ul>
        </Card>
      )}

      {tab === "Activity" && (
        <Card>
          <ol className="space-y-2">
            {(app?.events ?? []).map((e: any) => <li key={e.id} className="text-sm"><span className="font-medium">{e.type.replace("_", " ")}</span> <span className="text-muted-foreground">· {new Date(e.createdAt).toLocaleString()} {e.message ? `· ${e.message}` : ""}</span></li>)}
            {(c.stageHistory ?? []).map((h: any) => <li key={h.id} className="text-sm">Moved to <span className="font-medium">{h.stage}</span> <span className="text-muted-foreground">· {new Date(h.createdAt).toLocaleString()}</span></li>)}
            {!app?.events?.length && <p className="text-sm text-muted-foreground">No activity yet.</p>}
          </ol>
        </Card>
      )}
    </div>
  );
}
