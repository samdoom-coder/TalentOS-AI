"use client";

import { useState } from "react";
import Link from "next/link";
import { useMe, useApi, api } from "@/lib/client";
import { P } from "@/lib/db/json";
import { Card, PageHeader, Badge, Button, EmptyState, Skeleton, ErrorState } from "@/components/ui/primitives";

export default function InterviewsPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/interviews?orgId=${orgId}` : null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ title: "", mode: "text", durationMin: 15, topics: "", questionCount: 5 });

  async function create() {
    await api(`/api/v1/interviews`, {
      method: "POST",
      body: JSON.stringify({ organizationId: orgId, title: form.title, mode: form.mode, durationMin: form.durationMin, topics: form.topics.split(",").map((t) => t.trim()).filter(Boolean), questionCount: form.questionCount }),
    });
    setShowNew(false);
    reload();
  }

  return (
    <div>
      <PageHeader title="AI Interviews" subtitle="Configure once — the AI adapts follow-ups per answer." action={<Button onClick={() => setShowNew((v) => !v)}>+ New interview</Button>} />
      {showNew && (
        <Card className="mb-4 border-2">
          <div className="grid gap-2 md:grid-cols-2">
            <input className="input" placeholder="Interview title, e.g. Senior React Screen" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} aria-label="Interview title" />
            <select className="input" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })} aria-label="Mode">
              <option value="text">Text interview</option><option value="voice">Voice interview (STT/TTS ready)</option>
            </select>
            <input className="input" placeholder="Topics, comma separated" value={form.topics} onChange={(e) => setForm({ ...form, topics: e.target.value })} aria-label="Topics" />
            <input className="input" type="number" min={3} max={15} value={form.questionCount} onChange={(e) => setForm({ ...form, questionCount: Number(e.target.value) })} aria-label="Question count" />
          </div>
          <Button className="mt-3" disabled={!form.title} onClick={create}>Create & generate questions</Button>
        </Card>
      )}
      {loading && <Skeleton className="h-32" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No interviews yet" body="Create an AI interview — questions generate from the role automatically." />}
      <div className="space-y-3">
        {data?.map((i: any) => (
          <Link key={i.id} href={`/interviews/${i.id}`}>
            <Card className="transition hover:shadow-md">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{i.title}</p>
                <div className="flex gap-1.5"><Badge tone="blue">{i.mode}</Badge><Badge>{i.sessions?.length ?? 0} sessions</Badge></div>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{i.durationMin} min · {i.difficulty} · {P<string[]>(i.topics, []).join(", ") || "general"}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
