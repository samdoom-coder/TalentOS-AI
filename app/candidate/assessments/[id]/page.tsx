"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { P } from "@/lib/db/json";
import { Card, Button, ErrorState } from "@/components/ui/primitives";

export default function TakeAssessmentPage() {
  const { id } = useParams<{ id: string }>();
  const [bundle, setBundle] = useState<any>(null);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/v1/assessments/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "attempt" }) })
      .then(async (r) => {
        // Assessment detail route handles attempts via ?action — use direct call shape
        const j = await r.json();
        if (j.success) setBundle(j.data);
        else {
          // fallback: load questions read-only then start via query param route
          const g = await fetch(`/api/v1/assessments/${id}`).then((x) => x.json());
          if (g.success) {
            const start = await fetch(`/api/v1/assessments/${id}?action=attempt`, { method: "POST" }).then((x) => x.json()).catch(() => null);
            setBundle(start?.success ? start.data : { attemptId: null, assessment: g.data });
          } else setErr(g.error?.message ?? "Could not load assessment.");
        }
      })
      .catch((e) => setErr(e.message));
  }, [id]);

  async function submit() {
    const payload = Object.entries(answers).map(([questionId, answer]) => ({ questionId, answer }));
    const res = await fetch(`/api/v1/assessments/${id}?action=submit`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attemptId: bundle.attemptId, answers: payload }),
    });
    const j = await res.json();
    if (!j.success) { setErr(j.error?.message ?? "Submit failed."); return; }
    setResult(j.data);
  }

  const assessment = bundle?.assessment;
  if (err) return <ErrorState message={err} />;
  if (!assessment) return <div className="skeleton h-40" />;

  if (result) {
    return (
      <Card>
        <p className="text-lg font-semibold">Submitted! Score: {result.score}{result.passed === true ? " · Passed 🎉" : result.passed === false ? " · Not passed" : ""}</p>
        <p className="mt-1 text-sm text-muted-foreground">Free-text answers are queued for human review. You can close this page.</p>
      </Card>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">{assessment.title}</h1>
      <p className="text-sm text-muted-foreground">{assessment.description ?? "Answer all questions, then submit."}</p>
      <div className="mt-4 space-y-3">
        {(assessment.sections ?? []).flatMap((s: any) => s.questions).map((q: any, i: number) => (
          <Card key={q.id}>
            <p className="text-sm font-medium">{i + 1}. {q.prompt} <span className="text-muted-foreground">({q.points} pt)</span></p>
            {q.type === "mcq" && P<string[]>(q.options, []).map((o: string) => (
              <label key={o} className="mt-1 flex items-center gap-2 text-sm">
                <input type="radio" name={q.id} onChange={() => setAnswers({ ...answers, [q.id]: o })} /> {o}
              </label>
            ))}
            {q.type === "true_false" && ["True", "False"].map((o) => (
              <label key={o} className="mt-1 flex items-center gap-2 text-sm">
                <input type="radio" name={q.id} onChange={() => setAnswers({ ...answers, [q.id]: o })} /> {o}
              </label>
            ))}
            {!["mcq", "true_false"].includes(q.type) && (
              <textarea className="input mt-2 h-auto" rows={3} onChange={(e) => setAnswers({ ...answers, [q.id]: e.target.value })} aria-label={`Answer ${i + 1}`} />
            )}
          </Card>
        ))}
      </div>
      <Button className="mt-4 w-full" disabled={!bundle?.attemptId} onClick={submit}>Submit assessment</Button>
      {!bundle?.attemptId && <p className="mt-2 text-xs text-muted-foreground">Attempt initialising…</p>}
    </div>
  );
}
