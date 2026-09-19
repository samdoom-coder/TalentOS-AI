"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Badge, Button, EmptyState, Skeleton, ErrorState, ScoreBar, toCsv, downloadFile, toast } from "@/components/ui/primitives";

const STAGES = ["applied", "screening", "assessment", "interview", "technical_interview", "final_interview", "offer", "hired", "rejected"];

export default function CandidatesPage() {
  return (
    <Suspense>
      <CandidatesView />
    </Suspense>
  );
}

function useDebounced(value: string, ms = 350) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return v;
}

function CandidatesView() {
  const { orgId } = useMe();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const [stage, setStage] = useState(sp.get("stage") ?? "");
  const [skill, setSkill] = useState("");
  const [view, setView] = useState<"kanban" | "table">("kanban");
  const [compare, setCompare] = useState<string[]>([]);
  const [saved, setSaved] = useState<any[]>([]);

  const dq = useDebounced(q);
  const dskill = useDebounced(skill);

  const params = new URLSearchParams({ orgId: orgId ?? "" });
  if (dq) params.set("q", dq);
  if (stage) params.set("stage", stage);
  if (dskill) params.set("skill", dskill);
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/candidates?${params}` : null);

  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/v1/saved-searches?orgId=${orgId}`).then((r) => r.json()).then((j) => {
      if (j.success) setSaved(j.data);
    }).catch(() => undefined);
  }, [orgId]);

  async function saveSearch() {
    const name = window.prompt("Name this search (e.g. Senior React, Berlin):");
    if (!name) return;
    try {
      await api(`/api/v1/saved-searches`, { method: "POST", body: JSON.stringify({ organizationId: orgId, name, filters: { q: dq, stage, skill: dskill } }) });
      toast("Search saved");
      const j = await fetch(`/api/v1/saved-searches?orgId=${orgId}`).then((r) => r.json());
      if (j.success) setSaved(j.data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed");
    }
  }

  function exportCsv() {
    const rows = (data ?? []).map((c: any) => ({
      name: c.name, email: c.email, title: c.title ?? "", stage: c.applications?.[0]?.stage ?? "",
      matchScore: c.applications?.[0]?.matchScore ?? "", skills: (c.skills ?? []).map((s: any) => s.skill).join("; "),
    }));
    downloadFile("candidates.csv", toCsv(rows));
    toast(`Exported ${rows.length} candidates`);
  }

  const byStage = new Map<string, any[]>();
  for (const c of data ?? []) {
    const s = c.applications?.[0]?.stage ?? "applied";
    if (!byStage.has(s)) byStage.set(s, []);
    byStage.get(s)!.push(c);
  }

  async function move(appId: string, toStage: string) {
    try {
      await api(`/api/v1/applications/${appId}/move`, { method: "POST", body: JSON.stringify({ applicationId: appId, toStage }) });
      toast("Moved");
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Move failed");
    }
  }

  return (
    <div>
      <PageHeader
        title="Candidates"
        subtitle="Search is instant — filters update as you type."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setView(view === "kanban" ? "table" : "kanban")}>
              {view === "kanban" ? "Table view" : "Kanban view"}
            </Button>
            <Button variant="secondary" onClick={exportCsv}>Export CSV</Button>
            {compare.length >= 2 && <Link href={`/candidates/compare?ids=${compare.join(",")}`} className="btn-primary">Compare ({compare.length})</Link>}
          </div>
        }
      />
      <Card className="mb-4">
        <div className="grid gap-2 md:grid-cols-4">
          <input className="input" placeholder="Name, skill, title… (instant)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search candidates" />
          <input className="input" placeholder="Skill filter… (instant)" value={skill} onChange={(e) => setSkill(e.target.value)} aria-label="Filter by skill" />
          <select className="input" value={stage} onChange={(e) => setStage(e.target.value)} aria-label="Filter by stage">
            <option value="">All stages</option>
            {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={saveSearch}>Save search</Button>
          </div>
        </div>
        {saved.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1" aria-label="Saved searches">
            {saved.map((s: any) => (
              <button key={s.id} className="badge bg-muted text-muted-foreground hover:text-foreground"
                onClick={() => { setQ(s.filters?.q ?? ""); setStage(s.filters?.stage ?? ""); setSkill(s.filters?.skill ?? ""); }}>
                {s.name}
              </button>
            ))}
          </div>
        )}
      </Card>

      {loading && <div className="grid gap-3 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No candidates yet" body="Once candidates apply, you'll see them here with AI match scores." />}

      {view === "kanban" ? (
        <div className="grid items-start gap-3 md:grid-cols-3 xl:grid-cols-4">
          {STAGES.map((s) => (
            <div key={s} className="rounded-xl bg-muted/60 p-2">
              <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{s.replace("_", " ")} · {(byStage.get(s) ?? []).length}</p>
              <div className="space-y-2">
                {(byStage.get(s) ?? []).map((c: any) => (
                  <CandidateCard key={c.id} c={c} compare={compare} setCompare={setCompare} onMove={move} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Candidate</th><th>Job</th><th>Stage</th><th>Match</th><th></th></tr></thead>
              <tbody>
                {(data ?? []).map((c: any) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2"><Link href={`/candidates/${c.id}`} className="font-medium hover:underline">{c.name}</Link><p className="text-xs text-muted-foreground">{c.title ?? c.email}</p></td>
                    <td>{c.applications?.[0]?.job?.title ?? "—"}</td>
                    <td><Badge>{(c.applications?.[0]?.stage ?? "applied").replace("_", " ")}</Badge></td>
                    <td className="w-32">{c.applications?.[0]?.matchScore != null ? <ScoreBar score={c.applications[0].matchScore} /> : "—"}</td>
                    <td><Link href={`/candidates/${c.id}`} className="underline">Open</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function CandidateCard({ c, compare, setCompare, onMove }: any) {
  const app = c.applications?.[0];
  const checked = compare.includes(c.id);
  return (
    <div className="card p-3">
      <div className="flex items-start justify-between gap-2">
        <Link href={`/candidates/${c.id}`} className="font-medium hover:underline">{c.name}</Link>
        <input type="checkbox" aria-label={`Select ${c.name} for comparison`} checked={checked} onChange={() => setCompare(checked ? compare.filter((x: string) => x !== c.id) : [...compare, c.id].slice(0, 3))} />
      </div>
      <p className="text-xs text-muted-foreground">{c.title ?? c.email} · {c.experienceYrs ?? 0}y</p>
      {app?.matchScore != null && <ScoreBar score={app.matchScore} className="mt-2" />}
      <div className="mt-2 flex flex-wrap gap-1">
        {(c.skills ?? []).slice(0, 3).map((s: any) => <span key={s.id} className="badge bg-muted text-muted-foreground">{s.skill}</span>)}
      </div>
      {app && (
        <div className="mt-2 flex gap-1">
          <select className="input h-8 text-xs" defaultValue={app.stage} onChange={(e) => onMove(app.id, e.target.value)} aria-label={`Move ${c.name}`}>
            {STAGES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}
