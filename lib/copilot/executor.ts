import { prisma } from "@/lib/db/prisma";
import { can } from "@/lib/auth/rbac";
import { heuristicEvaluate } from "@/lib/matching/evaluate";
import { renderTemplate } from "@/lib/email/email";
import type { PlannedCall } from "./tools";

export interface ToolResult {
  tool: string;
  ok: boolean;
  data?: unknown;
  error?: string;
  needsConfirmation?: boolean;
}

interface ExecCtx {
  organizationId: string;
  role: string;
  userId: string;
}

function deny(tool: string, permission: string): ToolResult {
  return { tool, ok: false, error: `Forbidden: missing permission ${permission}.` };
}

function scopeError(tool: string): ToolResult {
  return { tool, ok: false, error: "Not found in your organization." };
}

/** Execute one planned tool with org scoping + RBAC. Never leaks cross-org rows. */
export async function executeTool(ctx: ExecCtx, call: PlannedCall): Promise<ToolResult> {
  const { organizationId, role } = ctx;
  try {
    switch (call.tool) {
      case "searchCandidates": {
        if (!can(role, "candidates:view")) return deny(call.tool, "candidates:view");
        const a = call.args as { query?: string; skill?: string; stage?: string; jobId?: string; limit?: number };
        const limit = Math.min(25, Math.max(1, a.limit ?? 8));
        const items = await prisma.candidate.findMany({
          where: {
            organizationId,
            deletedAt: null,
            ...(a.query ? { OR: [{ name: { contains: a.query } }, { email: { contains: a.query } }, { title: { contains: a.query } }] } : {}),
            ...(a.skill ? { skills: { some: { skill: { contains: a.skill } } } } : {}),
            ...(a.stage || a.jobId
              ? { applications: { some: { ...(a.jobId ? { jobId: a.jobId } : { job: { organizationId } }), ...(a.stage ? { stage: a.stage } : {}) } } }
              : {}),
          },
          include: {
            skills: { take: 6 },
            applications: { include: { job: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 2 },
          },
          orderBy: { createdAt: "desc" },
          take: limit,
        });
        return {
          tool: call.tool,
          ok: true,
          data: items.map((c) => ({
            id: c.id,
            name: c.name,
            email: c.email,
            title: c.title,
            stage: c.applications[0]?.stage ?? "applied",
            job: c.applications[0]?.job?.title ?? null,
            matchScore: c.applications[0]?.matchScore ?? null,
            skills: c.skills.map((s) => s.skill),
            href: `/candidates/${c.id}`,
          })),
        };
      }
      case "getCandidate": {
        if (!can(role, "candidates:view")) return deny(call.tool, "candidates:view");
        const { candidateId } = call.args as { candidateId: string };
        const c = await prisma.candidate.findFirst({
          where: { id: candidateId, organizationId, deletedAt: null },
          include: {
            skills: true,
            experience: true,
            applications: { include: { job: { select: { id: true, title: true } } }, orderBy: { createdAt: "desc" }, take: 5 },
            scores: { orderBy: { createdAt: "desc" }, take: 5 },
          },
        });
        if (!c) return scopeError(call.tool);
        return {
          tool: call.tool,
          ok: true,
          data: {
            id: c.id, name: c.name, email: c.email, title: c.title, location: c.location,
            experienceYrs: c.experienceYrs, summary: c.summary,
            skills: c.skills.map((s) => ({ skill: s.skill, years: s.years })),
            experience: c.experience.map((e) => ({ company: e.company, role: e.role, description: e.description })),
            applications: c.applications.map((a) => ({ job: a.job.title, stage: a.stage, matchScore: a.matchScore })),
            href: `/candidates/${c.id}`,
          },
        };
      }
      case "getJob": {
        if (!can(role, "jobs:view")) return deny(call.tool, "jobs:view");
        const { jobId } = call.args as { jobId: string };
        const job = await prisma.job.findFirst({
          where: { id: jobId, organizationId, deletedAt: null },
          include: { requirements: true, _count: { select: { applications: true } } },
        });
        if (!job) return scopeError(call.tool);
        return {
          tool: call.tool, ok: true,
          data: {
            id: job.id, title: job.title, status: job.status,
            applicants: job._count.applications,
            requirements: job.requirements.map((r) => ({ label: r.label, category: r.category, weight: r.weight, required: r.isRequired })),
            href: `/jobs/${job.id}`,
          },
        };
      }
      case "summarizeCandidate": {
        if (!can(role, "candidates:view")) return deny(call.tool, "candidates:view");
        const { candidateId, jobId } = call.args as { candidateId: string; jobId?: string };
        const c = await prisma.candidate.findFirst({
          where: { id: candidateId, organizationId, deletedAt: null },
          include: { skills: true, experience: true },
        });
        if (!c) return scopeError(call.tool);
        let requirements: { label: string; category: string; weight: number; isRequired: boolean }[] = [];
        if (jobId) {
          const job = await prisma.job.findFirst({ where: { id: jobId, organizationId }, include: { requirements: true } });
          if (job) requirements = job.requirements.map((r) => ({ label: r.label, category: r.category, weight: r.weight, isRequired: r.isRequired }));
        }
        const resumeText = [c.summary ?? "", c.skills.map((s) => s.skill).join(", "), c.experience.map((e) => `${e.role} at ${e.company}`).join("\n")].join("\n");
        const criteria = requirements.length ? heuristicEvaluate(requirements, resumeText) : [];
        const strengths = criteria.filter((x) => x.score >= 60).map((x) => x.name);
        const gaps = criteria.filter((x) => x.score < 50).map((x) => x.name);
        return {
          tool: call.tool, ok: true,
          data: {
            candidate: c.name, href: `/candidates/${c.id}`,
            overview: `${c.name} — ${c.title ?? "candidate"}${c.experienceYrs ? `, ${c.experienceYrs}y` : ""}. ${c.summary ?? ""}`.trim(),
            strengths: strengths.length ? strengths : c.skills.slice(0, 3).map((s) => s.skill),
            gaps,
            evidence: criteria.slice(0, 6).map((x) => ({ requirement: x.name, score: x.score, confidence: x.confidence, evidence: x.evidence[0] ?? "" })),
            followUps: gaps.slice(0, 3).map((g) => `Probe depth on ${g} with a concrete project example and metrics.`),
            note: "AI-generated summary — verify against resume + interview evidence.",
          },
        };
      }
      case "getAnalytics": {
        if (!can(role, "analytics:view")) return deny(call.tool, "analytics:view");
        const { jobId } = call.args as { jobId?: string };
        const where = { organizationId, ...(jobId ? { jobId } : {}) };
        const [applications, byStage, hired] = await Promise.all([
          prisma.application.count({ where }),
          prisma.application.groupBy({ by: ["stage"], where, _count: true }),
          prisma.application.count({ where: { ...where, status: "hired" } }),
        ]);
        return {
          tool: call.tool, ok: true,
          data: {
            applications, hired,
            conversionPct: applications ? Math.round((hired / applications) * 1000) / 10 : 0,
            byStage: byStage.map((s) => ({ stage: s.stage, count: s._count })),
            waitingReview: byStage.filter((s) => ["applied", "screening"].includes(s.stage)).reduce((a, s) => a + s._count, 0),
            href: "/analytics",
          },
        };
      }
      case "draftEmail": {
        if (!can(role, "messages:send")) return deny(call.tool, "messages:send");
        const a = call.args as { to?: string; candidateId?: string; subject?: string; body?: string; template?: string };
        const subject = a.subject ?? "Next step with {{company_name}} — {{job_title}}";
        const body = a.body ?? "Hi {{candidate_name}}, thanks for your interest in {{job_title}}. Next step: {{assessment_link}}.";
        return {
          tool: call.tool, ok: true,
          data: {
            to: a.to ?? "(pick a candidate to fill)",
            subject: renderTemplate(subject, { candidate_name: "Candidate", job_title: "the role", company_name: "your company", assessment_link: "(link)" }),
            bodyPreview: renderTemplate(body, { candidate_name: "Candidate", job_title: "the role", company_name: "your company", assessment_link: "(link)" }),
            note: "Draft only — open Messages to edit variables and approve the send. Nothing was sent.",
            href: "/messages",
          },
        };
      }
      case "proposeAction": {
        const a = call.args as { kind?: string; summary?: string; href?: string };
        return {
          tool: call.tool, ok: true, needsConfirmation: true,
          data: {
            kind: a.kind ?? "schedule_interview",
            summary: a.summary ?? "Proposed action needs your confirmation.",
            href: a.href ?? "/interviews",
            note: "Destructive actions require explicit confirmation — nothing was executed.",
          },
        };
      }
      default:
        return { tool: (call as { tool: string }).tool, ok: false, error: "Unknown tool." };
    }
  } catch (e) {
    return { tool: call.tool, ok: false, error: e instanceof Error ? e.message : "Tool failed." };
  }
}
