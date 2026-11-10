import { NextRequest } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";

// Public job detail. Only published jobs, and only fields a candidate needs.
// Internal ids/counts/org metadata must never be exposed here.
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const job = await prisma.job.findFirst({
    where: {
      OR: [{ id: params.id }, { slug: params.id }],
      status: "published",
      deletedAt: null,
    },
    select: {
      id: true,
      title: true,
      department: true,
      location: true,
      workMode: true,
      employmentType: true,
      salaryMin: true,
      salaryMax: true,
      salaryCurrency: true,
      description: true,
      responsibilities: true,
      slug: true,
      publishedAt: true,
      requirements: { select: { label: true, category: true, isRequired: true }, orderBy: { label: "asc" } },
      questions: { select: { id: true, question: true, type: true, required: true, sortOrder: true }, orderBy: { sortOrder: "asc" } },
      organization: { select: { name: true, logoUrl: true } },
    },
  });
  if (!job) return errorResponse("NOT_FOUND", "This job is not accepting applications.", 404);
  return successResponse(job);
}
