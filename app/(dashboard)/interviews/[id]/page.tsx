"use client";

import { useParams } from "next/navigation";
import { useApi } from "@/lib/client";
import { P } from "@/lib/db/json";
import { Card, PageHeader, Badge, Skeleton, ErrorState, ScoreBar } from "@/components/ui/primitives";

export default function InterviewDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: iv, loading, error, reload } = useApi<any>(`/api/v1/interviews/${id}`);

  if (loading) return <Skeleton className="h-40" />;
  if (error || !iv) return <ErrorState message={error ?? "Not found."} onRetry={reload} />;

  return (
    <div>
      <PageHeader title={iv.title} subtitle={`${iv.mode} · ${iv.durationMin} min · candidate link: /candidate/interviews/${iv.id}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="font-semibold">Questions</p>
          <ol className="mt-2 space-y-1 text-sm">
            {(iv.questions ?? []).map((q: any, i: number) => <li key={q.id}>{i + 1}. {q.prompt}</li>)}
            {!iv.questions?.length && <p className="text-muted-foreground">No pre-generated questions — the AI adapts live.</p>}
          </ol>
        </Card>
        <Card>
          <p className="font-semibold">Evaluation criteria</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {P<string[]>(iv.criteria, []).map((c: string) => <span key={c} className="badge bg-muted">{c}</span>)}
          </div>
        </Card>
      </div>
      <h2 className="mb-2 mt-6 text-lg font-semibold">Sessions & scorecards</h2>
      <div className="space-y-2">
        {(iv.sessions ?? []).map((s: any) => (
          <Card key={s.id}>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Session {s.id.slice(0, 8)} · {s.status} · {new Date(s.createdAt).toLocaleString()}</p>
              <a className="text-sm underline" href={`/api/v1/interviews/sessions/${s.id}/complete`}>View JSON</a>
            </div>
            <div className="mt-2 space-y-1">
              {(s.evaluations ?? []).map((e: any) => (
                <div key={e.id} className="text-sm">
                  <div className="flex justify-between"><span>{e.criterion}</span><Badge>{e.score}</Badge></div>
                  <ScoreBar score={e.score} className="mt-1 max-w-md" />
                  <p className="mt-0.5 text-xs text-muted-foreground">“{(e.evidence ?? "").slice(0, 200)}” · confidence {e.confidence}</p>
                </div>
              ))}
              {!s.evaluations?.length && <p className="text-sm text-muted-foreground">Not evaluated yet — complete the session from the candidate link.</p>}
            </div>
          </Card>
        ))}
        {!iv.sessions?.length && <p className="text-sm text-muted-foreground">No sessions yet.</p>}
      </div>
    </div>
  );
}
