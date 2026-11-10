"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { P } from "@/lib/db/json";
import { Card, Button, ErrorState } from "@/components/ui/primitives";

export default function TakeAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const invite = useSearchParams().get("invite");
  const [bundle, setBundle] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const body = invite ? JSON.stringify({ invite }) : "{}";
    fetch(`/api/v1/assessments/${id}?action=attempt`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    })
      .then(async (r) => {
        const j = await r.json();
        if (j.success) {
          setBundle(j.data);
        } else {
          setAuthRequired(r.status === 401);
          setErr(j.error?.message ?? "Could not start assessment.");
        }
      })
      .catch((e) => setErr(e.message));
  }, [id, invite]);

  useEffect(() => {
    if (!bundle?.expiresAt || result) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [bundle?.expiresAt, result]);

  const remaining = useMemo(() => {
    if (!bundle?.expiresAt) return null;
    return Math.max(0, new Date(bundle.expiresAt).getTime() - now);
  }, [bundle?.expiresAt, now]);

  async function submit() {
    if (!bundle?.attemptId || !bundle?.attemptToken || submitting) return;
    setSubmitting(true);
    setErr(null);
    const payload = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    try {
      const res = await fetch(`/api/v1/assessments/${id}?action=submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: bundle.attemptId, attemptToken: bundle.attemptToken, answers: payload }),
      });
      const j = await res.json();
      if (!j.success) {
        setErr(j.error?.message ?? "Submit failed.");
        return;
      }
      setResult(j.data);
    } finally {
      setSubmitting(false);
    }
  }

  const assessment = bundle?.assessment;
  if (authRequired) {
    const next = `/candidate/assessments/${id}${invite ? `?invite=${encodeURIComponent(invite)}` : ""}`;
    return (
      <Card>
        <p className="font-semibold">Sign in to take this assessment</p>
        <p className="mt-1 text-sm text-muted-foreground">Use the email address the hiring team invited. Your invite is tied to that account.</p>
        <Link className="btn-primary mt-3 inline-flex" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
      </Card>
    );
  }
  if (err && !assessment) return <ErrorState message={err} />;
  if (!assessment) return <div className="skeleton h-40" />;

  if (result) {
    return (
      <Card>
        <p className="text-lg font-semibold">
          Submitted! Score: {result.score}
          {result.passed === true ? " · Passed 🎉" : result.passed === false ? " · Not passed" : ""}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.pendingManualReview
            ? "Written answers are queued for human review before a final decision."
            : "This assessment was auto-graded. You can close this page."}
        </p>
      </Card>
    );
  }

  const lockSubmit = remaining !== null && remaining <= 0;
  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{assessment.title}</h1>
          <p className="text-sm text-muted-foreground">{assessment.description ?? "Answer all questions, then submit."}</p>
        </div>
        {remaining !== null && (
          <p className={`shrink-0 text-sm tabular-nums ${remaining < 60_000 ? "text-red-600" : "text-muted-foreground"}`}>
            {Math.floor(remaining / 60_000)}:{String(Math.floor((remaining % 60_000) / 1000)).padStart(2, "0")} left
          </p>
        )}
      </div>
      <div className="mt-4 space-y-3">
        {(assessment.sections ?? []).flatMap((s: any) => s.questions).map((q: any, i: number) => (
          <Card key={q.id}>
            <p className="text-sm font-medium">{i + 1}. {q.prompt} <span className="text-muted-foreground">({q.points} pt)</span></p>
            {q.type === "mcq" && P<string[]>(q.options, []).map((o: string) => (
              <label key={o} className="mt-1 flex items-center gap-2 text-sm">
                <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswers({ ...answers, [q.id]: o })} /> {o}
              </label>
            ))}
            {q.type === "true_false" && ["True", "False"].map((o) => (
              <label key={o} className="mt-1 flex items-center gap-2 text-sm">
                <input type="radio" name={q.id} checked={answers[q.id] === o} onChange={() => setAnswers({ ...answers, [q.id]: o })} /> {o}
              </label>
            ))}
            {q.type === "multi_select" && P<string[]>(q.options, []).map((o: string) => (
              <label key={o} className="mt-1 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Array.isArray(answers[q.id]) && answers[q.id].includes(o)}
                  onChange={(e) => {
                    const prev: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : [];
                    setAnswers({ ...answers, [q.id]: e.target.checked ? [...prev, o] : prev.filter((x) => x !== o) });
                  }}
                /> {o}
              </label>
            ))}
            {!["mcq", "true_false", "multi_select"].includes(q.type) && (
              <textarea className="input mt-2 h-auto" rows={4} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} aria-label={`Answer ${i + 1}`} />
            )}
          </Card>
        ))}
      </div>
      {err && <div className="mt-3"><ErrorState message={err} /></div>}
      <Button className="mt-4 w-full" disabled={!bundle?.attemptToken || submitting || lockSubmit} onClick={submit}>
        {submitting ? "Submitting…" : lockSubmit ? "Time expired" : "Submit assessment"}
      </Button>
      {!bundle?.attemptToken && <p className="mt-2 text-xs text-muted-foreground">Attempt initialising…</p>}
    </div>
  );
}
