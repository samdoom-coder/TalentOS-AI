"use client";

import { useState } from "react";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Badge, Button, Skeleton, ErrorState, toast, toCsv, downloadFile } from "@/components/ui/primitives";

export default function MessagesPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any>(orgId ? `/api/v1/messages?orgId=${orgId}` : null);
  const { data: cands } = useApi<any[]>(orgId ? `/api/v1/candidates?orgId=${orgId}&limit=100` : null);
  const [form, setForm] = useState({ to: "", candidateId: "", subject: "", body: "", template: "custom" });
  const [sent, setSent] = useState<string | null>(null);

  async function send() {
    setSent(null);
    try {
      const payload: Record<string, unknown> = { organizationId: orgId, ...form, vars: {} };
      // If a candidate is picked, default the email + link the record.
      const picked = (cands ?? []).find((c: any) => c.id === form.candidateId);
      if (picked && !form.to) payload.to = picked.email;
      await api(`/api/v1/messages`, { method: "POST", body: JSON.stringify(payload) });
      setSent("Message queued for sending.");
      toast("Message queued");
      setForm({ to: "", candidateId: "", subject: "", body: "", template: "custom" });
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Send failed");
    }
  }

  function useTemplate(key: string) {
    const t = data?.templates?.[key];
    if (t) setForm({ ...form, template: key, subject: t.subject, body: t.body });
  }

  function exportCsv() {
    const rows = (data?.messages ?? []).map((m: any) => ({ to: m.to ?? "", subject: m.subject ?? "", status: m.status ?? "", createdAt: m.createdAt ?? "" }));
    downloadFile("messages.csv", toCsv(rows));
  }

  return (
    <div>
      <PageHeader title="Messages" subtitle="Templates with variables — recruiter approves every send." action={<Button variant="secondary" onClick={exportCsv}>Export CSV</Button>} />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <p className="font-semibold">Compose (approval = send)</p>
          <div className="mt-2 space-y-2">
            <select className="input" value={form.template} onChange={(e) => useTemplate(e.target.value)} aria-label="Template">
              <option value="custom">Custom</option>
              {Object.keys(data?.templates ?? {}).map((k) => <option key={k} value={k}>{k.replace("_", " ")}</option>)}
            </select>
            <select className="input" value={form.candidateId} onChange={(e) => {
              const id = e.target.value;
              const picked = (cands ?? []).find((c: any) => c.id === id);
              setForm({ ...form, candidateId: id, to: picked ? picked.email : form.to });
            }} aria-label="Pick candidate">
              <option value="">Pick candidate (fills To)…</option>
              {(cands ?? []).map((c: any) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
            </select>
            <input className="input" placeholder="To" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} aria-label="Recipient" />
            <input className="input" placeholder="Subject — supports {{candidate_name}} {{job_title}}" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} aria-label="Subject" />
            <textarea className="input h-auto" rows={5} placeholder="Body — supports {{candidate_name}} {{job_title}} {{company_name}}" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} aria-label="Body" />
            <Button disabled={!form.to || !form.subject || !form.body} onClick={send}>Approve & send</Button>
            {sent && <p role="status" className="text-sm text-green-700">{sent}</p>}
          </div>
        </Card>
        <Card>
          <p className="font-semibold">Recent</p>
          {loading && <Skeleton className="mt-2 h-24" />}
          {error && <ErrorState message={error} onRetry={reload} />}
          <ul className="mt-2 space-y-2">
            {(data?.messages ?? []).map((m: any) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <span>{m.subject ?? m.channel} → {(m.body ?? "").slice(0, 60)}</span>
                <Badge tone={m.status === "sent" ? "green" : "amber"}>{m.status}</Badge>
              </li>
            ))}
            {!data?.messages?.length && !loading && <p className="text-sm text-muted-foreground">No messages yet.</p>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
