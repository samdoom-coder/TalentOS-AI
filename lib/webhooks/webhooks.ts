import { prisma } from "@/lib/db/prisma";
import { J, P } from "@/lib/db/json";
import { enqueue, registerHandler } from "@/lib/queue/queue";
import { fetchWithTimeout, isBlockedWebhookUrl } from "@/lib/security/fetch";
import crypto from "crypto";

export function signPayload(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

export async function emitEvent(organizationId: string, event: string, payload: unknown) {
  const hooks = await prisma.webhook.findMany({ where: { organizationId, enabled: true } });
  const interested = hooks.filter((h) => {
    const events = P<string[]>(h.events, []);
    return events.length === 0 || events.includes(event) || events.includes("*");
  });
  for (const h of interested) {
    await prisma.webhookDelivery.create({ data: { webhookId: h.id, event, payload: J(payload) } });
    await enqueue("webhooks", "deliver", { webhookId: h.id, event, payload });
  }
}

registerHandler("webhooks", "deliver", async (job) => {
  const { webhookId, event, payload } = job.payload as { webhookId: string; event: string; payload: unknown };
  const hook = await prisma.webhook.findUnique({ where: { id: webhookId } });
  if (!hook || !hook.enabled) return;
  if (isBlockedWebhookUrl(hook.url)) {
    await prisma.webhookDelivery.updateMany({ where: { webhookId, event, status: "pending" }, data: { status: "failed", attempts: { increment: 1 } } });
    throw new Error("Webhook URL blocked (SSRF guard)");
  }
  const body = JSON.stringify({ event, data: payload, sentAt: new Date().toISOString() }).slice(0, 500_000);
  const delivery = await prisma.webhookDelivery.findFirst({ where: { webhookId, event }, orderBy: { createdAt: "desc" } });
  try {
    const res = await fetchWithTimeout(
      hook.url,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(hook.secret ? { "X-TalentOS-Signature": signPayload(hook.secret, body) } : {}),
        },
        body,
      },
      10000
    );
    if (!res.ok) throw new Error(`Webhook ${res.status}`);
    if (delivery) await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: "delivered", attempts: { increment: 1 } } });
  } catch (e) {
    if (delivery) await prisma.webhookDelivery.update({ where: { id: delivery.id }, data: { status: "failed", attempts: { increment: 1 } } });
    throw e;
  }
});
