"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Button, EmptyState, Skeleton, ErrorState, toast, Dialog } from "@/components/ui/primitives";

export default function TalentPoolPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/talent?orgId=${orgId}` : null);
  const { data: cands } = useApi<any[]>(orgId ? `/api/v1/candidates?orgId=${orgId}&limit=50` : null);
  const [name, setName] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [pick, setPick] = useState("");

  async function create() {
    try {
      await api(`/api/v1/talent`, { method: "POST", body: JSON.stringify({ organizationId: orgId, name }) });
      setName("");
      toast("List created");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function addMember(listId: string) {
    if (!pick) return;
    try {
      await api(`/api/v1/talent/${listId}/members`, { method: "POST", body: JSON.stringify({ candidateId: pick }) });
      toast("Candidate added");
      setPick("");
      setAddingTo(null);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Add failed");
    }
  }

  async function removeMember(listId: string, candidateId: string) {
    try {
      await fetch(`/api/v1/talent/${listId}/members?candidateId=${candidateId}`, { method: "DELETE" }).then(async (r) => {
        const j = await r.json();
        if (!j.success) throw new Error(j.error?.message ?? "Remove failed");
      });
      toast("Removed");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Remove failed");
    }
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
            <p className="mt-1 text-sm">{l._count?.members ?? l.members?.length ?? 0} members</p>
            <ul className="mt-2 space-y-1 text-sm">
              {(l.members ?? []).slice(0, 8).map((m: any) => (
                <li key={m.id} className="flex items-center justify-between gap-2">
                  <span>{m.candidate?.name ?? m.candidateId} <span className="text-muted-foreground">· {m.candidate?.title ?? ""}</span></span>
                  <button className="text-xs underline" onClick={() => removeMember(l.id, m.candidateId)} aria-label={`Remove ${m.candidate?.name ?? ""}`}>remove</button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <Button variant="secondary" onClick={() => setAddingTo(l.id)}>Add member</Button>
              <Link href="/candidates" className="btn-secondary">Find candidates →</Link>
            </div>
          </Card>
        ))}
      </div>
      <Dialog open={!!addingTo} onClose={() => setAddingTo(null)} title="Add candidate to list">
        <select className="input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Pick candidate">
          <option value="">Select candidate…</option>
          {(cands ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
        </select>
        <div className="mt-3 flex gap-2">
          <Button disabled={!pick} onClick={() => addingTo && addMember(addingTo)}>Add</Button>
          <Button variant="secondary" onClick={() => setAddingTo(null)}>Cancel</Button>
        </div>
      </Dialog>
    </div>
  );
}
