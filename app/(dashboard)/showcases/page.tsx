"use client";

import { useState } from "react";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Button, EmptyState, Skeleton, ErrorState } from "@/components/ui/primitives";

export default function ShowcasesPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/showcase?orgId=${orgId}` : null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");

  async function create() {
    await api(`/api/v1/showcase`, { method: "POST", body: JSON.stringify({ organizationId: orgId, title, instructions }) });
    setTitle("");
    setInstructions("");
    reload();
  }

  return (
    <div>
      <PageHeader title="Showcases" subtitle="Candidates present real work — portfolio, demo or walkthrough." />
      <Card className="mb-4">
        <p className="font-semibold">Request showcase</p>
        <div className="mt-2 grid gap-2">
          <input className="input" placeholder="Title, e.g. Walk us through your best project" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Showcase title" />
          <input className="input" placeholder="Instructions for the candidate" value={instructions} onChange={(e) => setInstructions(e.target.value)} aria-label="Instructions" />
        </div>
        <Button className="mt-3" disabled={!title} onClick={create}>Create request</Button>
      </Card>
      {loading && <Skeleton className="h-24" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No showcases yet" body="Request a portfolio walkthrough — candidates record via browser media APIs." />}
      <div className="space-y-3">
        {data?.map((s: any) => (
          <Card key={s.id}>
            <p className="font-semibold">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.instructions ?? "—"}</p>
            <p className="mt-1 text-sm">{s.sessions?.length ?? 0} submissions</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
