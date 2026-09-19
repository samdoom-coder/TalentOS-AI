"use client";

import { useEffect, useState } from "react";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Button, Skeleton, ErrorState, toast, downloadFile } from "@/components/ui/primitives";

export default function SettingsPage() {
  const { orgId } = useMe();
  const { data: org, loading, error, reload } = useApi<any>(orgId ? `/api/v1/orgs?orgId=${orgId}` : null);
  const [hookUrl, setHookUrl] = useState("");
  const [hooks, setHooks] = useState<any[] | null>(null);
  const [keys, setKeys] = useState<any[] | null>(null);
  const [keyName, setKeyName] = useState("");
  const [privacyEmail, setPrivacyEmail] = useState("");

  async function loadHooks() {
    const r = await fetch(`/api/v1/webhooks?orgId=${orgId}`).then((x) => x.json());
    if (r.success) setHooks(r.data);
  }

  async function addHook() {
    await api(`/api/v1/webhooks`, { method: "POST", body: JSON.stringify({ organizationId: orgId, url: hookUrl, events: ["application.created", "application.stage_changed"] }) });
    setHookUrl("");
    loadHooks();
  }

  async function loadKeys() {
    try {
      const r = await fetch(`/api/v1/api-keys?orgId=${orgId}`).then((x) => x.json());
      if (r.success) setKeys(r.data);
      else toast(r.error?.message ?? "Keys load failed");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Keys failed");
    }
  }

  useEffect(() => { if (orgId) { loadHooks(); loadKeys(); } }, [orgId]);

  async function createKey() {
    try {
      const r = await api<{ secret: string }>(`/api/v1/api-keys`, { method: "POST", body: JSON.stringify({ organizationId: orgId, name: keyName }) });
      setKeyName("");
      toast("Key created — copy now");
      window.prompt("API key (shown once — copy now):", r.secret);
      loadKeys();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Create failed");
    }
  }

  async function revokeKey(id: string) {
    await fetch(`/api/v1/api-keys?id=${id}&orgId=${orgId}`, { method: "DELETE" });
    toast("Key revoked");
    loadKeys();
  }

  async function exportCandidate() {
    try {
      const r = await fetch(`/api/v1/privacy?orgId=${orgId}&email=${encodeURIComponent(privacyEmail)}`).then((x) => x.json());
      if (!r.success) throw new Error(r.error?.message ?? "Export failed");
      downloadFile(`candidate-${privacyEmail}.json`, JSON.stringify(r.data, null, 2), "application/json");
      toast("Exported");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Export failed");
    }
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Workspace, stages, integrations and API." />
      {loading && <Skeleton className="h-32" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {org && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <p className="font-semibold">{org.name}</p>
            <p className="text-sm text-muted-foreground">Slug: {org.slug} · Plan: {org.subscriptions?.[0]?.plan ?? "free"} · Your role: {org.myRole}</p>
            <p className="mt-3 font-semibold">Team</p>
            <ul className="mt-1 space-y-1 text-sm">
              {org.members.map((m: any) => <li key={m.id}>{m.user.name} · {m.user.email} · {m.role}</li>)}
            </ul>
          </Card>
          <Card>
            <p className="font-semibold">ATS stages</p>
            <ul className="mt-1 space-y-1 text-sm">
              {org.atsStages.map((s: any) => <li key={s.id}>{s.sortOrder + 1}. {s.name} <span className="text-muted-foreground">→ candidate sees “{s.candidateFacing ?? s.name}”</span></li>)}
            </ul>
          </Card>
          <Card>
            <p className="font-semibold">Integrations</p>
            <p className="mt-1 text-sm text-muted-foreground">Calendar, Zoom/Meet, Slack/Teams, job boards and HRIS plug in here. Architecture is provider-abstracted; enable per deployment.</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Google Calendar — ready interface</li>
              <li>Slack / Teams — webhook-compatible</li>
              <li>Zoom / Meet — scheduling links</li>
            </ul>
          </Card>
          <Card>
            <p className="font-semibold">Webhooks</p>
            <div className="mt-2 flex gap-2">
              <input className="input" placeholder="https://…" value={hookUrl} onChange={(e) => setHookUrl(e.target.value)} aria-label="Webhook URL" />
              <Button variant="secondary" disabled={!hookUrl} onClick={addHook}>Add</Button>
              <Button variant="secondary" onClick={loadHooks}>Refresh</Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(hooks ?? []).map((h: any) => <li key={h.id}>{h.url} · {h.enabled ? "enabled" : "disabled"} · {h.deliveries?.length ?? 0} deliveries</li>)}
            </ul>
          </Card>
          <Card>
            <p className="font-semibold">API keys <span className="text-xs font-normal text-muted-foreground">(secret shown once)</span></p>
            <div className="mt-2 flex gap-2">
              <input className="input" placeholder="Key name, e.g. Greenhouse sync" value={keyName} onChange={(e) => setKeyName(e.target.value)} aria-label="Key name" />
              <Button variant="secondary" disabled={!keyName} onClick={createKey}>Create</Button>
              <Button variant="secondary" onClick={loadKeys}>Refresh</Button>
            </div>
            <ul className="mt-2 space-y-1 text-sm">
              {(keys ?? []).map((k: any) => (
                <li key={k.id} className="flex items-center justify-between gap-2">
                  <span>{k.name} · <span className="text-muted-foreground">{k.keyPrefix}… {k.revokedAt ? "(revoked)" : ""}</span></span>
                  {!k.revokedAt && <button className="text-xs underline" onClick={() => revokeKey(k.id)}>revoke</button>}
                </li>
              ))}
              {keys && keys.length === 0 && <li className="text-muted-foreground">No keys yet.</li>}
            </ul>
          </Card>
          <Card>
            <p className="font-semibold">Privacy (GDPR-style)</p>
            <p className="mt-1 text-sm text-muted-foreground">Export or erase a candidate by email (audited).</p>
            <div className="mt-2 flex gap-2">
              <input className="input" placeholder="candidate@email" value={privacyEmail} onChange={(e) => setPrivacyEmail(e.target.value)} aria-label="Candidate email" />
              <Button variant="secondary" disabled={!privacyEmail} onClick={exportCandidate}>Export JSON</Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Deletion is in the candidate profile (self) and via API with confirm: DELETE.</p>
          </Card>
        </div>
      )}
    </div>
  );
}
