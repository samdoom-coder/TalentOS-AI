import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession, requireOrgAccess } from "@/lib/auth/session";

// SSE: live unread count + org-scoped resume pipeline health. Poll-friendly
// fallback included (shell polls /notifications every 30s; this stream pushes
// faster when open). Never exposes cross-tenant aggregate counts.
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (orgId) {
    try {
      await requireOrgAccess(orgId);
    } catch {
      return new Response(JSON.stringify({ error: "forbidden" }), { status: 403 });
    }
  }
  const encoder = new TextEncoder();
  // Scope resume pipeline counts to candidates in this org (Resume has no
  // organization relation of its own).
  const orgCandidateIds = orgId
    ? (await prisma.candidate.findMany({ where: { organizationId: orgId }, select: { id: true } })).map((c) => c.id)
    : [];
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      req.signal?.addEventListener("abort", () => { closed = true; });
      for (let i = 0; i < 20 && !closed; i++) {
        try {
          const [unread, pipeline] = await Promise.all([
            prisma.notification.count({ where: { userId: session.sub, read: false } }),
            orgId && orgCandidateIds.length
              ? prisma.resume.groupBy({
                  by: ["status"],
                  where: { candidateId: { in: orgCandidateIds } },
                  _count: true,
                })
              : Promise.resolve([]),
          ]);
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ unread, pipeline, at: new Date().toISOString(), orgId })}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ heartbeat: true })}\n\n`));
        }
        await new Promise((r) => setTimeout(r, 5000));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
