"use client";

import { useParams } from "next/navigation";
import { useApi, api } from "@/lib/client";
import { P } from "@/lib/db/json";
import { Card, PageHeader, Badge, Button, Skeleton, ErrorState, ScoreBar } from "@/components/ui/primitives";

export default function AssessmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: a, loading, error, reload } = useApi<any>(`/api/v1/assessments/${id}`);

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
                {t.score != null && <Badge tone={t.passed ? "green" : "amber"}>{t.score} · {t.passed ? "Passed" : t.passed === false ? "Failed" : "—"}</Badge>}
                <Button variant="secondary" onClick={() => gradeFreeText(t.id)}>Review</Button>
              </div>
            </div>
            {t.score != null && <ScoreBar score={t.score} className="mt-2 max-w-md" />}
            {t.result && <p className="mt-1 text-xs text-muted-foreground">{t.result.feedback}</p>}
          </Card>
        ))}
        {!a.attempts?.length && <p className="text-sm text-muted-foreground">No attempts yet. Share the candidate link: /candidate/assessments/{a.id}</p>}
      </div>
    </div>
  );
}
