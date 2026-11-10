import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";

// Interview scheduling: recruiter availability + candidate booking.
// Calendar integrations (Google/Microsoft) plug in here later.
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  if (!orgId) return errorResponse("VALIDATION_ERROR", "orgId is required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  const slots = await prisma.availabilitySlot.findMany({ where: { organizationId: orgId }, orderBy: { start: "asc" }, take: 100 });
  return successResponse(slots);
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      organizationId: z.string(),
      start: z.string().datetime(),
      end: z.string().datetime(),
      timezone: z.string().default("UTC"),
      slotId: z.string().optional(),
      bookedBy: z.string().optional(),
    }).parse(await req.json());
    const { session } = await requireOrgAccess(body.organizationId);
    if (body.slotId) {
      const slot = await prisma.availabilitySlot.findFirst({
        where: { id: body.slotId, organizationId: body.organizationId },
      });
      if (!slot) return errorResponse("NOT_FOUND", "Availability slot not found in this organization.", 404);
      if (slot.bookedBy && slot.bookedBy !== (body.bookedBy ?? session.sub)) {
        return errorResponse("CONFLICT", "This slot is already booked.", 409);
      }
      const updated = await prisma.availabilitySlot.update({
        where: { id: slot.id },
        data: { bookedBy: body.bookedBy ?? session.sub },
      });
      return successResponse(updated);
    }
    const slot = await prisma.availabilitySlot.create({
      data: { organizationId: body.organizationId, userId: session.sub, start: new Date(body.start), end: new Date(body.end), timezone: body.timezone },
    });
    return successResponse(slot, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid slot.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
