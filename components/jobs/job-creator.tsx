"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { Card, Button, ErrorState } from "@/components/ui/primitives";

export function JobCreator({ orgId, onDone }: { orgId: string; onDone: () => void }) {
  const [brief, setBrief] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function generate() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api<{ draft: string }>(`/api/v1/jobs/draft/generate`, {
        method: "POST",
        body: JSON.stringify({ brief, organizationId: orgId }),
      });
      setDescription(r.draft);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setBusy(false);
    }
  }

  async function create(publish: boolean) {
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/v1/jobs`, {
        method: "POST",
        body: JSON.stringify({ organizationId: orgId, title, description, status: publish ? "published" : "draft", requirements: [], questions: [] }),
      });
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-4 border-2">
      <p className="font-semibold">New job</p>
      {err && <div className="mt-2"><ErrorState message={err} /></div>}
      <div className="mt-3 space-y-3">
        <div>
          <label className="label" htmlFor="brief">One-line brief (AI draft)</label>
          <div className="flex gap-2">
            <input id="brief" className="input" placeholder="Need a senior React dev who knows Next.js, TypeScript, Postgres…" value={brief} onChange={(e) => setBrief(e.target.value)} />
            <Button variant="secondary" disabled={busy || brief.length < 10} onClick={generate}>Generate</Button>
          </div>
        </div>
        <div><label className="label" htmlFor="jtitle">Job title</label><input id="jtitle" className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Senior Frontend Engineer" /></div>
        <div><label className="label" htmlFor="jdesc">Description (editable before publishing)</label><textarea id="jdesc" rows={6} className="input h-auto" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="flex gap-2">
          <Button disabled={busy || !title || description.length < 20} onClick={() => create(true)}>{busy ? "Saving…" : "Publish job"}</Button>
          <Button variant="secondary" disabled={busy || !title || description.length < 20} onClick={() => create(false)}>Save draft</Button>
        </div>
      </div>
    </Card>
  );
}
