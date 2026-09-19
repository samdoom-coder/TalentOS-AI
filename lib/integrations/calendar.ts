// Calendar + meeting integrations (Google / Microsoft / Zoom).
// OAuth URLs built from env; tokens stored in Integration.config (JSON).
// Event creation uses fetch when tokens present, else returns a local
// availability slot + placeholder meet link so flows work offline.

import { prisma } from "@/lib/db/prisma";
import { J, P } from "@/lib/db/json";
import { fetchWithTimeout } from "@/lib/security/fetch";

export type CalendarType = "google_calendar" | "teams" | "zoom";

export function oauthUrl(type: CalendarType, orgId: string): string | null {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const cb = `${appUrl}/api/v1/integrations/callback?type=${type}&orgId=${orgId}`;
  if (type === "google_calendar") {
    const id = process.env.GOOGLE_CLIENT_ID;
    if (!id) return null;
    const scope = encodeURIComponent("https://www.googleapis.com/auth/calendar.events");
    return `https://accounts.google.com/o/oauth2/v2/auth?client_id=${id}&redirect_uri=${encodeURIComponent(cb)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent`;
  }
  if (type === "teams") {
    const id = process.env.MS_CLIENT_ID;
    if (!id) return null;
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${id}&redirect_uri=${encodeURIComponent(cb)}&response_type=code&scope=${encodeURIComponent("https://graph.microsoft.com/Calendars.ReadWrite OnlineMeetings.ReadWrite")}`;
  }
  if (type === "zoom") {
    const id = process.env.ZOOM_CLIENT_ID;
    if (!id) return null;
    return `https://zoom.us/oauth/authorize?client_id=${id}&redirect_uri=${encodeURIComponent(cb)}&response_type=code`;
  }
  return null;
}

export async function getTokens(orgId: string, type: string): Promise<Record<string, string>> {
  const row = await prisma.integration.findFirst({ where: { organizationId: orgId, type } });
  return P<Record<string, string>>(row?.config, {});
}

export async function saveTokens(orgId: string, type: string, tokens: Record<string, string>) {
  const existing = await prisma.integration.findFirst({ where: { organizationId: orgId, type } });
  if (existing) {
    await prisma.integration.update({ where: { id: existing.id }, data: { config: J(tokens), enabled: true } });
  } else {
    await prisma.integration.create({ data: { organizationId: orgId, type, config: J(tokens), enabled: true } });
  }
}

export async function createMeeting(input: { orgId: string; type: CalendarType; title: string; start: string; end: string; timezone?: string; attendee?: string }): Promise<{ link: string; provider: string }> {
  const tokens = await getTokens(input.orgId, input.type);
  try {
    if (input.type === "google_calendar" && tokens.access_token) {
      const res = await fetchWithTimeout("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ summary: input.title, start: { dateTime: input.start, timeZone: input.timezone ?? "UTC" }, end: { dateTime: input.end, timeZone: input.timezone ?? "UTC" }, attendees: input.attendee ? [{ email: input.attendee }] : [] }),
      }, 15000);
      if (res.ok) {
        const data = await res.json() as { hangoutLink?: string; htmlLink?: string };
        return { link: data.hangoutLink ?? data.htmlLink ?? "", provider: "google" };
      }
    }
    if (input.type === "zoom" && tokens.access_token) {
      const res = await fetchWithTimeout("https://api.zoom.us/v2/users/me/meetings", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ topic: input.title, type: 2, start_time: input.start, duration: 30 }),
      }, 15000);
      if (res.ok) {
        const data = await res.json() as { join_url?: string };
        return { link: data.join_url ?? "", provider: "zoom" };
      }
    }
  } catch { /* fall through to local slot */ }
  // Offline-safe: persist slot locally + placeholder link recruiters replace.
  const slot = await prisma.availabilitySlot.create({
    data: { organizationId: input.orgId, userId: "system", start: new Date(input.start), end: new Date(input.end), timezone: input.timezone ?? "UTC" },
  });
  return { link: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/interviews?slot=${slot.id}`, provider: "local" };
}
