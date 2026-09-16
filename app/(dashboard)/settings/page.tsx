"use client";

import { useState } from "react";
import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Button, Skeleton, ErrorState } from "@/components/ui/primitives";

export default function SettingsPage() {
  const { orgId } = useMe();
  const { data: org, loading, error, reload } = useApi<any>(orgId ? `/api/v1/orgs?orgId=${orgId}` : null);
  const [hookUrl, setHookUrl] = useState("");
  const [hooks, setHooks] = useState<any[] | null>(null);

  async function loadHooks() {
    const r = await fetch(`/api/v1/webhooks?orgId=${orgId}`).then((x) => x.json());
    if (r.success) setHooks(r.data);
  }

  async function addHook() {
    await api(`/api/v1/webhooks`, { method: "POST", body: JSON.stringify({ organizationId: orgId, url: hookUrl, events: ["application.created", "application.stage_changed"] }) });
    setHookUrl("");
    loadHooks();
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
        </div>
      )}
    </div>
  );
}
