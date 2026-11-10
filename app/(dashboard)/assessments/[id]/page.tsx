"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useApi, useMe, api } from "@/lib/client";
import { P } from "@/lib/db/json";
import { Card, PageHeader, Badge, Button, Skeleton, ErrorState, ScoreBar } from "@/components/ui/primitives";

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { orgId } = useMe();
  const { data: a, loading, error, reload } = useApi<any>(`/api/v1/assessments/${id}`);
  const { data: candidates } = useApi<any[]>(orgId ? `/api/v1/candidates?orgId=${orgId}&limit=100` : null);
  const [inviteCandidateId, setInviteCandidateId] = useState("");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteErr, setInviteErr] = useState<string | null>(null);

  const eligible = (candidates ?? []).filter(
    (c: any) => !a?.jobId || (c.applications ?? []).some((app: any) => app.jobId === a.jobId)
  );

  async function createInvite() {
    if (!inviteCandidateId) return;
    setInviteBusy(true);
    setInviteErr(null);
    setInviteUrl(null);
    try {
      const r = await api<{ path: string }>(`/api/v1/assessments/${id}/invite`, {
        method: "POST",
        body: JSON.stringify({ candidateId: inviteCandidateId }),
      });
      setInviteUrl(`${window.location.origin}${r.path}`);
    } catch (e) {
      setInviteErr(e instanceof Error ? e.message : "Could not create invite.");
    } finally {
      setInviteBusy(false);
    }
  }

  async function copyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl).catch(() => undefined);
  }

  async function gradeFreeText(attemptId: string) {
    // Manual reviewer feedback hook: mark reviewed (free-text needs human review).
    await api(`/api/v1/feedback`, { method: "POST", body: JSON.stringify({ applicationId: a.attempts?.[0]?.applicationId ?? "", body: `Reviewed attempt ${attemptId.slice(0, 8)}` }) }).catch(() => undefined);
    alert("Free-text answers require manual review — recorded in application feedback when linked.");
  }

  if (loading) return <Skeleton className="h-40" />;
  if (error || !a) return <ErrorState message={error ?? "Not found."} onRetry={reload} />;

  return (
    <div>
      <PageHeader title={a.title} subtitle={`${a.sections?.reduce((n: number, s: any) => n + s.questions.length, 0)} questions · pass ≥ ${a.passingScore ?? "—"} · max attempts ${a.maxAttempts}`} />

      <Card className="mb-4 border-2">
        <p className="font-semibold">Invite a candidate</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite links are signed and expire after 7 days. The candidate must sign in with the invited email.
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <select className="input" value={inviteCandidateId} onChange={(e) => setInviteCandidateId(e.target.value)} aria-label="Candidate to invite">
            <option value="">Select a candidate…</option>
            {eligible.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name} — {c.email}</option>
            ))}
          </select>
          <Button disabled={!inviteCandidateId || inviteBusy} onClick={createInvite}>{inviteBusy ? "Creating…" : "Generate invite link"}</Button>
        </div>
        {eligible.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No eligible candidates{a.jobId ? " applied to this job" : ""} yet.</p>}
        {inviteErr && <p role="alert" className="mt-2 text-sm text-red-700">{inviteErr}</p>}
        {inviteUrl && (
          <div className="mt-3 rounded-lg bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">Share this link securely</p>
            <p className="mt-1 break-all text-sm">{inviteUrl}</p>
            <Button variant="secondary" className="mt-2" onClick={copyInvite}>Copy link</Button>
          </div>
        )}
      </Card>

      {(a.sections ?? []).map((s: any) => (
        <Card key={s.id} className="mb-3">
          <p className="font-semibold">{s.title}</p>
          <ol className="mt-2 space-y-2">
            {s.questions.map((q: any, i: number) => (
              <li key={q.id} className="text-sm">
                <span className="font-medium">{i + 1}. [{q.type}]</span> {q.prompt}
                {q.options && <p className="mt-0.5 text-xs text-muted-foreground">Options: {P<string[]>(q.options, []).join(" · ")}</p>}
              </li>
            ))}
          </ol>
        </Card>
      ))}
      <h2 className="mb-2 mt-6 text-lg font-semibold">Attempts & review</h2>
      <div className="space-y-2">
        {(a.attempts ?? []).map((t: any) => (
          <Card key={t.id}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">Attempt {t.id.slice(0, 8)} · {t.status} · {t.submittedAt ? new Date(t.submittedAt).toLocaleString() : "in progress"}</p>
              <div className="flex items-center gap-2">
                {t.score != null && <Badge tone={t.passed ? "green" : "amber"}>{t.score} · {t.passed ? "Passed" : t.passed === false ? "Failed" : "Review"}</Badge>}
                <Button variant="secondary" onClick={() => gradeFreeText(t.id)}>Review</Button>
              </div>
            </div>
            {t.score != null && <ScoreBar score={t.score} className="mt-2 max-w-md" />}
            {t.result && <p className="mt-1 text-xs text-muted-foreground">{t.result.feedback}</p>}
          </Card>
        ))}
        {!a.attempts?.length && <p className="text-sm text-muted-foreground">No attempts yet. Generate an invite link above.</p>}
      </div>
    </div>
  );
}
