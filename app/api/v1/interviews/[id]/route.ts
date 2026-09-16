import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const i = await prisma.interview.findUnique({
    where: { id: params.id },
    include: { questions: { orderBy: { sortOrder: "asc" } }, sessions: { orderBy: { createdAt: "desc" }, take: 20, include: { evaluations: true } } },
  });
  if (!i) return errorResponse("NOT_FOUND", "Interview could not be found.", 404);
  return successResponse(i);
}
