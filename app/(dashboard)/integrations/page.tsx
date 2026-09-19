"use client";

import { useMe, useApi, api } from "@/lib/client";
import { Card, PageHeader, Badge, Button, EmptyState, Skeleton, ErrorState, toast } from "@/components/ui/primitives";

const META: Record<string, { name: string; desc: string }> = {
  google_calendar: { name: "Google Calendar", desc: "Availability + interview invites. OAuth per deployment." },
  slack: { name: "Slack / Teams", desc: "Stage + notification webhooks. Compatible with existing emitEvent." },
  zoom: { name: "Zoom / Meet", desc: "Scheduling links attached to availability slots." },
  teams: { name: "Microsoft Teams", desc: "Meetings + calendar via Graph (interface-ready)." },
  job_board: { name: "Job Boards", desc: "Publish via public API (/public/jobs) — LinkedIn/Indeed adapters plug in." },
  hris: { name: "HRIS Export", desc: "CSV/JSON hire export for downstream HR systems." },
};

export default function IntegrationsPage() {
  const { orgId } = useMe();
  const { data, loading, error, reload } = useApi<any[]>(orgId ? `/api/v1/integrations?orgId=${orgId}` : null);

  async function toggle(type: string, enabled: boolean) {
    try {
      await api(`/api/v1/integrations`, { method: "POST", body: JSON.stringify({ organizationId: orgId, type, enabled }) });
      toast(enabled ? `${type} enabled` : `${type} disabled`);
      reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed");
    }
  }

  return (
    <div>
      <PageHeader title="Integrations" subtitle="Calendar, meetings, chat, job boards, HRIS — provider-abstracted, enable per deployment." />
      {loading && <Skeleton className="h-24" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.length === 0 && <EmptyState title="No integrations" body="Enable what your deployment supports." />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((i: any) => (
          <Card key={i.type}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold">{META[i.type]?.name ?? i.type}</p>
              <Badge tone={i.enabled && !i._missing ? "green" : "default"}>{i.enabled && !i._missing ? "enabled" : "disabled"}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{META[i.type]?.desc ?? ""}</p>
            <div className="mt-3 flex gap-2">
              <Button variant="secondary" onClick={() => toggle(i.type, !(i.enabled && !i._missing))}>
                {i.enabled && !i._missing ? "Disable" : "Enable"}
              </Button>
              {i.type === "job_board" && <a className="btn-secondary" href="/careers">View public board</a>}
              {i.type === "slack" && <a className="btn-secondary" href="/settings">Webhooks</a>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
