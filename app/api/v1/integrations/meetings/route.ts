import { NextRequest } from "next/server";
import { z } from "zod";
import { errorResponse, successResponse } from "@/lib/utils";
import { requireOrgAccess } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { oauthUrl, createMeeting, type CalendarType } from "@/lib/integrations/calendar";

// GET ?orgId=&type= -> OAuth URL (or null when env not configured)
// POST {organizationId, type, title, start, end, timezone?, attendee?} -> meeting link
export async function GET(req: NextRequest) {
  const orgId = req.nextUrl.searchParams.get("orgId");
  const type = req.nextUrl.searchParams.get("type") as CalendarType | null;
  if (!orgId || !type) return errorResponse("VALIDATION_ERROR", "orgId + type required.", 400);
  try {
    await requireOrgAccess(orgId);
  } catch {
    return errorResponse("UNAUTHORIZED", "Not authorized.", 401);
  }
  return successResponse({ url: oauthUrl(type, orgId), configured: Boolean(oauthUrl(type, orgId)) });
}

export async function POST(req: NextRequest) {
  try {
    const body = z.object({
      organizationId: z.string(),
      type: z.enum(["google_calendar", "teams", "zoom"]),
      title: z.string().min(3),
      start: z.string().datetime(),
      end: z.string().datetime(),
      timezone: z.string().default("UTC"),
      attendee: z.string().email().optional(),
    }).parse(await req.json());
    const { membership } = await requireOrgAccess(body.organizationId);
    if (!can(membership.role, "interviews:manage")) return errorResponse("FORBIDDEN", "Cannot schedule.", 403);
    const out = await createMeeting({ orgId: body.organizationId, type: body.type, title: body.title, start: body.start, end: body.end, timezone: body.timezone, attendee: body.attendee });
    return successResponse(out, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return errorResponse("VALIDATION_ERROR", "Invalid meeting.", 400, e.flatten());
    const status = (e as Error & { status?: number }).status ?? 500;
    return errorResponse("INTERNAL_ERROR", e instanceof Error ? e.message : "Failed.", status);
  }
}
