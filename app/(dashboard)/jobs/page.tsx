"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe, useApi } from "@/lib/client";
import { JobCreator } from "@/components/jobs/job-creator";
import { Card, PageHeader, Badge, Button, EmptyState, Skeleton, ErrorState } from "@/components/ui/primitives";

export default function JobsPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/jobs?orgId=${orgId}&limit=50` : null);
  const [showNew, setShowNew] = useState(false);

  return (
    <div>
      <PageHeader title="Jobs" subtitle="Create, publish and track roles." action={<Button onClick={() => setShowNew((v) => !v)}>+ New job</Button>} />
      {showNew && orgId && <JobCreator orgId={orgId} onDone={() => { setShowNew(false); reload(); }} />}
      {loading && <div className="space-y-3"><Skeleton className="h-24" /><Skeleton className="h-24" /></div>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <EmptyState title="No jobs yet" body="Create your first role — AI can draft the description from a one-line brief." action={<Button onClick={() => setShowNew(true)}>Create a job</Button>} />
      )}
      <div className="space-y-3">
        {data?.map((j: any) => (
          <Link key={j.id} href={`/jobs/${j.id}`}>
            <Card className="transition hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">{j.title}</p>
                <div className="flex gap-1.5">
                  <Badge tone={j.status === "published" ? "green" : "default"}>{j.status}</Badge>
                  <Badge>{j._count?.applications ?? 0} applicants</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{[j.department, j.location, j.workMode].filter(Boolean).join(" · ")}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
