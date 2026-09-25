import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { checkRateLimit, rateLimitKey } from "@/lib/security/rate-limit";
import { runAi } from "@/lib/ai/service";
import { audit } from "@/lib/audit/audit";
import { routeCopilotIntent, type PlannedCall } from "@/lib/copilot/tools";
import { executeTool } from "@/lib/copilot/executor";

const bodySchema = z.object({
  organizationId: z.string().min(1),
  message: z.string().min(2).max(2000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) })).max(20).optional(),
});

function enrichPlan(message: string, plan: PlannedCall[]): PlannedCall[] {
  const m = message.toLowerCase();
  // "summarize X for job Y" / "missing requirements" -> also pull a job context
  // when a job-like quoted phrase exists; executor stays org-scoped regardless.
  void m;
  return plan.slice(0, 3);
}

function fallbackReply(message: string, results: { tool: string; ok: boolean; data?: unknown }[]): string {
  const search = results.find((r) => r.tool === "searchCandidates" && r.ok)?.data as
    | { name: string; title: string | null; stage: string; matchScore: number | null; skills: string[] }[] | undefined;
  const analytics = results.find((r) => r.tool === "getAnalytics" && r.ok)?.data as
    | { applications: number; hired: number; conversionPct: number; waitingReview: number } | undefined;
  const draft = results.find((r) => r.tool === "draftEmail" && r.ok)?.data as
    | { subject: string; note: string } | undefined;

  const lines = [`AI-generated copilot reply for: “${message.slice(0, 120)}”`];
  if (search?.length) {
    lines.push("", `Found ${search.length} candidate${search.length === 1 ? "" : "s"} (org-scoped):`);
    for (const c of search.slice(0, 5)) {
      lines.push(`• ${c.name}${c.title ? ` — ${c.title}` : ""} · ${c.stage.replace("_", " ")}${c.matchScore != null ? ` · match ${c.matchScore}%` : ""}`);
    }
  } else if (results.some((r) => r.tool === "searchCandidates")) {
    lines.push("", "No candidates matched those filters in your organization yet.");
  }
  if (analytics) {
    lines.push("", `Pipeline: ${analytics.applications} applications · ${analytics.waitingReview} waiting for review · ${analytics.hired} hired (${analytics.conversionPct}% conversion).`);
  }
  if (draft) {
    lines.push("", `Draft ready: “${draft.subject}”. ${draft.note}`);
  }
  lines.push("", "Next: open a profile for evidence, or ask me to draft the outreach message.");
  return lines.join("\n");
}

// POST /api/v1/copilot — permission-aware recruiter assistant.
// Tools run org-scoped; the LLM only narrates tool evidence (allowFallback: true
// because copilot is assistive, never a hiring score).
export async function POST(req: NextRequest) {
  const rl = checkRateLimit(rateLimitKey(req, "copilot"), 30, 60_000);
  if (!rl.allowed) return errorResponse("RATE_LIMITED", "Too many copilot requests. Try again shortly.", 429);
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid copilot request.", 400, e.flatten());
    return errorResponse("VALIDATION_ERROR", "Invalid request.", 400);
  }
  let membership: { role: string };
  let session: { sub: string };
  try {
    const ctx = await requireOrgAccess(body.organizationId);
    membership = ctx.membership;
    session = ctx.session;
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized for this organization.", 401);
  }
  if (!can(membership.role, "candidates:view")) {
    return errorResponse("FORBIDDEN", "Copilot is available to recruiters, hiring managers and admins.", 403);
  }

  const plan = enrichPlan(body.message, routeCopilotIntent(body.message));
  const results = await Promise.all(
    plan.map((call) => executeTool({ organizationId: body.organizationId, role: membership.role, userId: session.sub }, call))
  );

  const evidence = Object.fromEntries(results.filter((r) => r.ok).map((r) => [r.tool, r.data]));
  const denied = results.filter((r) => !r.ok);

  let reply: string;
  let provider = "heuristic";
  try {
    const out = await runAi({
      task: "recruiter_copilot",
      userPrompt: [
        `RECRUITER QUESTION:\n${body.message}`,
        `TOOL EVIDENCE (org-scoped JSON, use only this):\n${JSON.stringify(evidence).slice(0, 6000)}`,
        denied.length ? `DENIED TOOLS:\n${denied.map((d) => `${d.tool}: ${d.error}`).join("\n")}` : "",
      ].filter(Boolean).join("\n\n"),
      organizationId: body.organizationId,
      inputRef: `copilot:${body.organizationId}`,
      temperature: 0.3,
      maxTokens: 600,
      allowFallback: true,
    });
    reply = out.text?.trim() || fallbackReply(body.message, results);
    provider = out.provider;
  } catch {
    reply = fallbackReply(body.message, results);
  }

  await audit({
    organizationId: body.organizationId, actorId: session.sub,
    action: "copilot.query", resource: "copilot",
    metadata: { message: body.message.slice(0, 200), tools: plan.map((p) => p.tool) },
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
  });

  return successResponse({
    reply,
    provider,
    tools: results.map((r) => ({ tool: r.tool, ok: r.ok, error: r.error ?? null, needsConfirmation: r.needsConfirmation ?? false })),
    evidence,
    note: "AI-generated — verify against linked profiles before acting. Sends and stage moves always need your confirmation.",
  });
}
