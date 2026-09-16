"use client";

import Link from "next/link";
import { useMe, useApi } from "@/lib/client";
import { Card, PageHeader, Badge, EmptyState, Skeleton } from "@/components/ui/primitives";

export default function DashboardPage() {
  const { orgId } = useMe();
  const { data, loading } = useApi<any>(orgId ? `/api/v1/analytics?orgId=${orgId}` : null);

  const funnel = data?.funnel;
  const cards = [
    { label: "Active Jobs", value: data?.jobs?.filter((j: any) => j.status === "published").length ?? "—", href: "/jobs" },
    { label: "Applications", value: funnel?.applications ?? "—", href: "/candidates" },
    { label: "In Review", value: stageCount(funnel?.byStage, ["screening", "applied"]) ?? "—", href: "/candidates?stage=screening" },
    { label: "Assessments Done", value: funnel?.assessmentsCompleted ?? "—", href: "/assessments" },
    { label: "Interviews Done", value: funnel?.interviewsCompleted ?? "—", href: "/interviews" },
    { label: "Hired", value: funnel?.hired ?? "—", href: "/candidates" },
    { label: "Time to Hire", value: data?.timeToHireDays !== null && data?.timeToHireDays !== undefined ? `${data.timeToHireDays}d` : "—", href: "/analytics" },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Your hiring pipeline at a glance." action={<Link href="/jobs" className="btn-primary">+ New job</Link>} />
      {loading ? (
        <div className="grid gap-3 md:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Link key={c.label} href={c.href}><Card className="transition hover:shadow-md">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
            </Card></Link>
          ))}
          <Card>
            <p className="text-xs text-muted-foreground">AI spend (14d)</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">${data?.ai?.estimatedCostUsd ?? 0}</p>
            <p className="mt-1 text-xs text-muted-foreground">{data?.ai?.totalTokens ?? 0} tokens</p>
          </Card>
        </div>
      )}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="font-semibold">Hiring pipeline</p>
          {!funnel ? <Skeleton className="mt-3 h-20" /> : funnel.byStage?.length ? (
            <ul className="mt-3 space-y-2">
              {funnel.byStage.map((s: any) => (
                <li key={s.stage} className="flex items-center justify-between text-sm">
                  <span className="capitalize">{s.stage.replace("_", " ")}</span>
                  <Badge>{s._count}</Badge>
                </li>
              ))}
            </ul>
          ) : <div className="mt-3"><EmptyState title="No candidates yet" body="Once candidates apply, you'll see them here." action={<Link href="/jobs" className="btn-secondary">Create a job</Link>} /></div>}
        </Card>
        <Card>
          <p className="font-semibold">Recent jobs</p>
          <ul className="mt-3 space-y-2">
            {(data?.jobs ?? []).slice(0, 5).map((j: any) => (
              <li key={j.id} className="flex items-center justify-between text-sm">
                <Link href={`/jobs/${j.id}`} className="font-medium hover:underline">{j.title}</Link>
                <span className="text-muted-foreground">{j._count.applications} applicants · {j.status}</span>
              </li>
            ))}
            {!data?.jobs?.length && !loading && <p className="mt-2 text-sm text-muted-foreground">No jobs yet.</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function stageCount(byStage: any[] | undefined, stages: string[]) {
  if (!byStage) return undefined;
  return byStage.filter((s) => stages.includes(s.stage)).reduce((a, s) => a + s._count, 0);
}
