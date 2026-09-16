"use client";

import { useState } from "react";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Badge, Button, EmptyState, Skeleton, ErrorState } from "@/components/ui/primitives";

const PRESETS = ["Sales Call", "Customer Support", "Manager Conflict", "Negotiation", "Client Presentation", "Incident Response", "Product Demo"];

export default function RoleplaysPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/roleplay/scenarios?orgId=${orgId}` : null);
  const [form, setForm] = useState({ title: "Sales Call", persona: "Skeptical enterprise buyer", scenario: "Candidate must discover needs, handle a pricing objection, and agree a next step.", objectives: "Discover needs, Handle objection, Agree next step" });

  async function create() {
    await api(`/api/v1/roleplay/scenarios`, {
      method: "POST",
      body: JSON.stringify({ organizationId: orgId, title: form.title, persona: form.persona, scenario: form.scenario, objectives: form.objectives.split(",").map((s) => s.trim()).filter(Boolean) }),
    });
    reload();
  }

  return (
    <div>
      <PageHeader title="Role Plays" subtitle="Scenario-based evaluation — AI plays the counterpart." />
      <Card className="mb-4">
        <p className="font-semibold">New scenario</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          <select className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Scenario preset">
            {PRESETS.map((p) => <option key={p}>{p}</option>)}
          </select>
          <input className="input" value={form.persona} onChange={(e) => setForm({ ...form, persona: e.target.value })} aria-label="Persona" />
          <input className="input md:col-span-2" value={form.scenario} onChange={(e) => setForm({ ...form, scenario: e.target.value })} aria-label="Scenario brief" />
          <input className="input md:col-span-2" value={form.objectives} onChange={(e) => setForm({ ...form, objectives: e.target.value })} aria-label="Objectives, comma separated" />
        </div>
        <Button className="mt-3" onClick={create}>Create scenario</Button>
      </Card>
      {loading && <Skeleton className="h-24" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No scenarios yet" body="Create a sales call, support case or negotiation to evaluate soft skills." />}
      <div className="space-y-3">
        {data?.map((s: any) => (
          <Card key={s.id}>
            <div className="flex items-center justify-between"><p className="font-semibold">{s.title}</p><Badge>{s.sessions?.length ?? 0} sessions</Badge></div>
            <p className="mt-1 text-sm text-muted-foreground">Persona: {s.persona}</p>
            <p className="mt-1 text-sm">{s.scenario}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
