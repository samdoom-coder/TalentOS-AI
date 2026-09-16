import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
  const items = await prisma.notification.findMany({ where: { userId: session.sub }, orderBy: { createdAt: "desc" }, take: 30 });
  const unread = await prisma.notification.count({ where: { userId: session.sub, read: false } });
  return successResponse({ items, unread });
}

export async function PATCH(req: NextRequest) {
  const session = await getSession();
  if (!session) return errorResponse("UNAUTHORIZED", "Not signed in.", 401);
  const { ids } = z.object({ ids: z.array(z.string()).optional() }).parse(await req.json().catch(() => ({})));
  await prisma.notification.updateMany({ where: { userId: session.sub, ...(ids ? { id: { in: ids } } : {}) }, data: { read: true } });
  return successResponse({ ok: true });
}
