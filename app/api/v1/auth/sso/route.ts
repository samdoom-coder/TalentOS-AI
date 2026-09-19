import { NextRequest } from "next/server";
import { errorResponse, successResponse } from "@/lib/utils";
import { ssoProviders } from "@/lib/auth/sso";

// Lists SSO entry points (Phase 5 stub). Local auth keeps working.
export async function GET(_req: NextRequest) {
  return successResponse({ providers: ssoProviders() });
}
