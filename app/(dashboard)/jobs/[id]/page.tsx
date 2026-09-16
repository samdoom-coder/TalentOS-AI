"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useApi, api } from "@/lib/client";
import { Card, PageHeader, Badge, Button, Skeleton, ErrorState, ScoreBar } from "@/components/ui/primitives";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: job, loading, error, reload } = useApi<any>(`/api/v1/jobs/${id}`);
  const [reqs, setReqs] = useState<{ label: string; category: string; weight: number; isRequired: boolean }[]>([]);
  const [editing, setEditing] = useState(false);
  const [newReq, setNewReq] = useState({ label: "", category: "skill", weight: 15, isRequired: false });

  async function saveRequirements() {
    const list = editing && reqs.length === 0 && job ? job.requirements.map((r: any) => ({ category: r.category, label: r.label, weight: r.weight, isRequired: r.isRequired })) : reqs;
    await api(`/api/v1/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ requirements: list.length ? list : (job?.requirements ?? []).map((r: any) => ({ category: r.category, label: r.label, weight: r.weight, isRequired: r.isRequired })) }) });
    setEditing(false);
    setReqs([]);
    reload();
  }

  async function setStatus(status: string) {
    await api(`/api/v1/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
    reload();
  }

  if (loading) return <div className="space-y-3"><Skeleton className="h-10 w-64" /><Skeleton className="h-40" /></div>;
  if (error || !job) return <ErrorState message={error ?? "Job not found."} onRetry={reload} />;

  const totalWeight = (job.requirements ?? []).reduce((a: number, r: any) => a + r.weight, 0);

  return (
    <div>
      <PageHeader
        title={job.title}
        subtitle={`${job.status} · ${job._count?.applications ?? 0} applicants · public link below`}
        action={
          <div className="flex gap-2">
            <Link href={`/careers/${job.id}`} className="btn-secondary">Public page</Link>
            {job.status === "draft" ? <Button onClick={() => setStatus("published")}>Publish</Button>
              : job.status === "published" ? <Button variant="secondary" onClick={() => setStatus("closed")}>Close</Button>
              : <Button variant="secondary" onClick={() => setStatus("published")}>Republish</Button>}
          </div>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <p className="font-semibold">Description</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{job.description}</p>
          {job.responsibilities && <><p className="mt-4 font-semibold">Responsibilities</p><p className="mt-2 whitespace-pre-wrap text-sm">{job.responsibilities}</p></>}
        </Card>
        <Card>
          <div className="flex items-center justify-between">
            <p className="font-semibold">Requirements · {Math.round(totalWeight)}%</p>
            <button className="text-sm underline" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel" : "Edit"}</button>
          </div>
          <ul className="mt-3 space-y-2">
            {(job.requirements ?? []).map((r: any) => (
              <li key={r.id} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{r.label} {r.isRequired && <Badge tone="blue">required</Badge>}</span>
                  <span className="text-muted-foreground">{r.weight}%</span>
                </div>
                <ScoreBar score={r.weight * 2} className="mt-1" />
              </li>
            ))}
            {!job.requirements?.length && <p className="mt-2 text-sm text-muted-foreground">No structured requirements yet — add them to power matching.</p>}
          </ul>
          {editing && (
            <div className="mt-3 space-y-2 border-t pt-3">
              <div className="flex gap-2">
                <input className="input" placeholder="e.g. TypeScript" value={newReq.label} onChange={(e) => setNewReq({ ...newReq, label: e.target.value })} />
                <input className="input w-20" type="number" min={1} max={100} value={newReq.weight} onChange={(e) => setNewReq({ ...newReq, weight: Number(e.target.value) })} aria-label="Weight percent" />
                <Button variant="secondary" onClick={() => { if (newReq.label) { setReqs([...reqs, newReq]); setNewReq({ label: "", category: "skill", weight: 15, isRequired: false }); } }}>Add</Button>
              </div>
              {reqs.map((r) => <p key={r.label} className="text-sm">+ {r.label} · {r.weight}%</p>)}
              <Button onClick={saveRequirements} className="w-full">Save requirements</Button>
            </div>
          )}
        </Card>
      </div>
      <Card className="mt-4">
        <p className="font-semibold">Shareable application link</p>
        <p className="mt-1 font-mono text-sm text-muted-foreground">/careers/{job.id} (embeddable widget + future job-board integrations use the same public API)</p>
      </Card>
    </div>
  );
}
