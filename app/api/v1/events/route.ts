import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { getSession } from "@/lib/auth/session";

// SSE: live unread count + resume pipeline health. Poll-friendly fallback included
// (shell polls /notifications every 30s; this stream pushes faster when open).
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401 });
  }
  const orgId = req.nextUrl.searchParams.get("orgId");
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      req.signal?.addEventListener("abort", () => { closed = true; });
      for (let i = 0; i < 20 && !closed; i++) {
        try {
          const [unread, pipeline] = await Promise.all([
            prisma.notification.count({ where: { userId: session.sub, read: false } }),
            prisma.resume.groupBy({ by: ["status"], _count: true }).catch(() => []),
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
