import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse, getPagination } from "@/lib/utils";

// Public job board (no auth): only published jobs. Embeddable widget can hit this.
export async function GET(req: NextRequest) {
  const { page, limit, skip, take } = getPagination(req.nextUrl.searchParams);
  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const where = {
    status: "published",
    deletedAt: null,
    ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }, { location: { contains: q } }] } : {}),
  };
  const [total, jobs] = await Promise.all([
    prisma.job.count({ where }),
    prisma.job.findMany({
      where,
      select: {
        id: true, title: true, department: true, location: true, workMode: true,
        employmentType: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
        description: true, slug: true, publishedAt: true,
        requirements: { select: { label: true, category: true, isRequired: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip, take,
    }),
  ]);
  if (total === 0) return errorResponse("NOT_FOUND", "No published jobs yet.", 404);
  return successResponse(jobs, 200, { total, page, limit, totalPages: Math.ceil(total / limit) });
}
