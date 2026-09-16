"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Button, EmptyState, Skeleton, ErrorState } from "@/components/ui/primitives";

export default function TalentPoolPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/talent?orgId=${orgId}` : null);
  const [name, setName] = useState("");

  async function create() {
    await api(`/api/v1/talent`, { method: "POST", body: JSON.stringify({ organizationId: orgId, name }) });
    setName("");
    reload();
  }

  return (
    <div>
      <PageHeader title="Talent Pool" subtitle="Reusable lists of past applicants and passive candidates." />
      <Card className="mb-4">
        <div className="flex gap-2">
          <input className="input" placeholder="New list, e.g. Senior React" value={name} onChange={(e) => setName(e.target.value)} aria-label="List name" />
          <Button disabled={!name} onClick={create}>Create list</Button>
        </div>
      </Card>
      {loading && <Skeleton className="h-24" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No talent lists yet" body="Save promising candidates here for future roles." />}
      <div className="grid gap-3 md:grid-cols-3">
        {data?.map((l: any) => (
          <Card key={l.id}>
            <p className="font-semibold">{l.name}</p>
            <p className="text-sm text-muted-foreground">{l.description ?? ""}</p>
            <p className="mt-1 text-sm">{l._count?.members ?? 0} members</p>
            <Link href="/candidates" className="mt-2 inline-block text-sm underline">Find candidates to add →</Link>
          </Card>
        ))}
      </div>
    </div>
  );
}
