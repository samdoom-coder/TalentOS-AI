"use client";

import { useState } from "react";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Button, Badge, EmptyState, Skeleton, ErrorState, toast } from "@/components/ui/primitives";

export default function ShowcasesPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/showcase?orgId=${orgId}` : null);
  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  async function create() {
    try {
      await api(`/api/v1/showcase`, { method: "POST", body: JSON.stringify({ organizationId: orgId, title, instructions }) });
      setTitle("");
      setInstructions("");
      toast("Showcase request created");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Create failed");
    }
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
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{s.title}</p>
              <Badge>{s.sessions?.length ?? 0} submissions</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{s.instructions ?? "—"}</p>
            <Button variant="secondary" className="mt-2" onClick={() => setOpen(open === s.id ? null : s.id)}>
              {open === s.id ? "Hide submissions" : "Review submissions"}
            </Button>
            {open === s.id && (
              <div className="mt-3 space-y-2">
                {(s.sessions ?? []).length === 0 && <p className="text-sm text-muted-foreground">No submissions yet. Share the candidate link.</p>}
                {(s.sessions ?? []).map((sub: any) => (
                  <div key={sub.id} className="rounded-lg border p-3 text-sm">
                    <p><span className="font-medium">Project:</span> {sub.projectUrl ? <a className="underline" href={sub.projectUrl} target="_blank" rel="noreferrer">{sub.projectUrl}</a> : "—"}</p>
                    <p className="mt-1"><span className="font-medium">Walkthrough:</span> {sub.description ?? "—"}</p>
                    {sub.transcript && <p className="mt-1 text-muted-foreground">Transcript: {sub.transcript.slice(0, 300)}</p>}
                    <p className="mt-1"><Badge tone={sub.status === "submitted" ? "blue" : "default"}>{sub.status}</Badge></p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
