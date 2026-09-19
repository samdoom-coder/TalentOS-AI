import { prisma } from "@/lib/db/prisma";
import { J } from "@/lib/db/json";
import { enqueue, registerHandler } from "@/lib/queue/queue";
import { fetchWithTimeout } from "@/lib/security/fetch";

// Unified email abstraction (console provider in dev; plug Resend/SendGrid/SES in prod).
// All sends are queued; important candidate comms require recruiter approval upstream.

export interface SendEmailInput {
  organizationId: string;
  to: string;
  subject: string;
  body: string;
  template?: string;
  candidateId?: string;
  applicationId?: string;
}

const FROM = process.env.EMAIL_FROM ?? "TalentOS AI <noreply@talentos.ai>";

export async function sendEmail(input: SendEmailInput) {
  const message = await prisma.message.create({
    data: {
      organizationId: input.organizationId,
      candidateId: input.candidateId,
      applicationId: input.applicationId,
      channel: "email",
      direction: "outbound",
      subject: input.subject,
      body: input.body,
      template: input.template,
      status: "queued",
    },
  });
  await enqueue("email", "send-email", { messageId: message.id, to: input.to, subject: input.subject, body: input.body });
  return message;
}

registerHandler("email", "send-email", async (job) => {
  const { messageId, to, subject, body } = job.payload as { messageId: string; to: string; subject: string; body: string };
  const provider = (process.env.EMAIL_PROVIDER ?? "console").toLowerCase();
  try {
    if (provider === "console") {
      console.log(`[email] From: ${FROM}\nTo: ${to}\nSubject: ${subject}\n\n${body}\n`);
    } else if (provider === "resend") {
      const key = process.env.EMAIL_API_KEY;
      if (!key) throw new Error("EMAIL_API_KEY missing for resend");
      const res = await fetchWithTimeout("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to, subject, text: body }),
      }, 15000);
      if (!res.ok) throw new Error(`resend ${res.status}: ${(await res.text()).slice(0, 300)}`);
    } else if (provider === "sendgrid") {
      const key = process.env.EMAIL_API_KEY;
      if (!key) throw new Error("EMAIL_API_KEY missing for sendgrid");
      const res = await fetchWithTimeout("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ personalizations: [{ to: [{ email: to }] }], from: { email: FROM }, subject, content: [{ type: "text/plain", value: body }] }),
      }, 15000);
      if (!res.ok && res.status !== 202) throw new Error(`sendgrid ${res.status}: ${(await res.text()).slice(0, 300)}`);
    } else {
      // Generic webhook email (e.g. SES-via-lambda, Postmark): POST JSON.
      const hook = process.env.EMAIL_WEBHOOK_URL;
      if (!hook) throw new Error(`EMAIL_PROVIDER=${provider} needs EMAIL_API_KEY or EMAIL_WEBHOOK_URL`);
      const res = await fetchWithTimeout(hook, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(process.env.EMAIL_API_KEY ? { Authorization: `Bearer ${process.env.EMAIL_API_KEY}` } : {}) },
        body: JSON.stringify({ from: FROM, to, subject, body }),
      }, 15000);
      if (!res.ok) throw new Error(`email webhook ${res.status}`);
    }
    await prisma.message.update({ where: { id: messageId }, data: { status: "sent", sentAt: new Date() } });
    await prisma.emailEvent.create({ data: { messageId, type: "sent", metadata: J({ to, provider }) } });
  } catch (e) {
    await prisma.message.update({ where: { id: messageId }, data: { status: "failed" } }).catch(() => undefined);
    await prisma.emailEvent.create({ data: { messageId, type: "failed", metadata: J({ to, error: e instanceof Error ? e.message : "send failed" }) } }).catch(() => undefined);
    throw e;
  }
});

// ---- Message templates with {{variables}} ----

export const MESSAGE_TEMPLATES: Record<string, { subject: string; body: string }> = {
  application_received: {
    subject: "Thanks for applying to {{job_title}} at {{company_name}}",
    body: "Hi {{candidate_name}},\n\nWe've received your application for {{job_title}}. We'll review it and be in touch soon.\n\n— {{company_name}}",
  },
  assessment_invitation: {
    subject: "Your assessment for {{job_title}}",
    body: "Hi {{candidate_name}},\n\nPlease complete your assessment here: {{assessment_link}}\n\nGood luck!\n— {{company_name}}",
  },
  interview_invitation: {
    subject: "Interview invitation: {{job_title}}",
    body: "Hi {{candidate_name}},\n\nWe'd like to invite you to an interview on {{interview_date}}: {{interview_link}}\n\n— {{company_name}}",
  },
  reminder: {
    subject: "Reminder: {{job_title}} next step",
    body: "Hi {{candidate_name}},\n\nJust a friendly reminder about your next step for {{job_title}}.\n\n— {{company_name}}",
  },
  rejection: {
    subject: "Update on your application for {{job_title}}",
    body: "Hi {{candidate_name}},\n\nThanks for your interest in {{job_title}}. We've decided to move forward with other candidates this time.\n\n— {{company_name}}",
  },
  offer: {
    subject: "Offer: {{job_title}} at {{company_name}}",
    body: "Hi {{candidate_name}},\n\nWe're excited to offer you {{job_title}}! Reply to discuss next steps.\n\n— {{company_name}}",
  },
};

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? `{{${k}}}`);
}

export function validateTemplateVars(template: string, vars: Record<string, string>): string[] {
  const missing: string[] = [];
  for (const m of template.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!(m[1] in vars) || !vars[m[1]]) missing.push(m[1]);
  }
  return [...new Set(missing)];
}
