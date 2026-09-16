"use client";

import { useMe, useApi } from "@/lib/client";
import { Card, PageHeader, Badge, Skeleton, ErrorState, ScoreBar } from "@/components/ui/primitives";

export default function AnalyticsPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any>(orgId ? `/api/v1/analytics?orgId=${orgId}` : null);

  return (
    <div>
      <PageHeader title="Analytics" subtitle="Funnel, quality, and AI cost in one place." />
      {loading && <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <Card><p className="text-xs text-muted-foreground">Applications</p><p className="text-2xl font-semibold">{data.funnel.applications}</p></Card>
            <Card><p className="text-xs text-muted-foreground">Conversion</p><p className="text-2xl font-semibold">{data.conversion}%</p></Card>
            <Card><p className="text-xs text-muted-foreground">Time to hire</p><p className="text-2xl font-semibold">{data.timeToHireDays ?? "—"}{data.timeToHireDays != null ? "d" : ""}</p></Card>
            <Card><p className="text-xs text-muted-foreground">AI spend</p><p className="text-2xl font-semibold">${data.ai.estimatedCostUsd}</p><p className="text-xs text-muted-foreground">{data.ai.totalTokens} tokens</p></Card>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <p className="font-semibold">Pipeline by stage</p>
              <ul className="mt-2 space-y-2">
                {(data.funnel.byStage ?? []).map((s: any) => (
                  <li key={s.stage} className="text-sm"><div className="flex justify-between"><span className="capitalize">{s.stage.replace("_", " ")}</span><Badge>{s._count}</Badge></div></li>
                ))}
              </ul>
            </Card>
            <Card>
              <p className="font-semibold">Jobs</p>
              <ul className="mt-2 space-y-2">
                {(data.jobs ?? []).map((j: any) => (
                  <li key={j.id} className="flex items-center justify-between text-sm"><span>{j.title}</span><span className="text-muted-foreground">{j._count.applications} apps · {j.status}</span></li>
                ))}
              </ul>
            </Card>
            <Card>
              <p className="font-semibold">AI usage (daily)</p>
              <ul className="mt-2 space-y-1 text-sm">
                {(data.ai.usage ?? []).slice(0, 7).map((u: any) => (
                  <li key={u.id} className="flex justify-between"><span>{u.day} · {u.provider}/{u.model}</span><span className="tabular-nums">{u.tokensIn + u.tokensOut} tok · ${u.costUsd.toFixed(4)}</span></li>
                ))}
                {!data.ai.usage?.length && <p className="text-muted-foreground">No AI runs yet.</p>}
              </ul>
            </Card>
            <Card>
              <p className="font-semibold">Screening → assessment → interview</p>
              <p className="mt-2 text-sm">Assessments completed: <span className="font-semibold">{data.funnel.assessmentsCompleted}</span></p>
              <p className="text-sm">Interviews completed: <span className="font-semibold">{data.funnel.interviewsCompleted}</span></p>
              <p className="mt-2 text-xs text-muted-foreground">Source performance & per-stage dwell time plug into this dataset next.</p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
