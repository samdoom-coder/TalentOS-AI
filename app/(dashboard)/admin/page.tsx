"use client";

import Link from "next/link";
import { useApi } from "@/lib/client";
import { Card, PageHeader, Skeleton, ErrorState } from "@/components/ui/primitives";

export default function AdminPage() {
  const { data, loading, error, reload } = useApi<any>(`/api/v1/admin`);

  return (
    <div>
      <PageHeader title="Admin" subtitle="Platform health across your organizations. (Full super-admin + SSO/SCIM arrive in Phase 5.)" />
      {loading && <Skeleton className="h-32" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && (
        <div className="grid gap-3 md:grid-cols-3">
          {[["Organizations", data.orgs], ["Users", data.users], ["Jobs", data.jobs], ["Candidates", data.candidates], ["AI runs", data.aiRuns]].map(([l, v]) => (
            <Card key={l as string}><p className="text-xs text-muted-foreground">{l}</p><p className="text-2xl font-semibold">{v as number}</p></Card>
          ))}
          <Card>
            <p className="text-xs text-muted-foreground">Resume pipeline</p>
            <ul className="mt-1 text-sm">{(data.resumePipeline ?? []).map((r: any) => <li key={r.status}>{r.status}: {r._count}</li>)}</ul>
          </Card>
        </div>
      )}
      <p className="mt-4 text-sm text-muted-foreground">Restricted to organization owners/admins. Normal members never see this page. <Link href="/settings" className="underline">Workspace settings →</Link></p>
    </div>
  );
}
