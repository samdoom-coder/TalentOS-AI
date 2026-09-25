import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Frontend routing-level guard (never the only authorization — every API
// re-validates session + org membership server-side).
const PUBLIC_EXACT = new Set(["/", "/login", "/signup", "/forgot-password", "/careers"]);

// Route groups like (dashboard) don't appear in URLs, so guard the real paths.
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/candidate",
  "/admin",
  "/jobs",
  "/candidates",
  "/assessments",
  "/interviews",
  "/roleplays",
  "/showcases",
  "/messages",
  "/analytics",
  "/copilot",
  "/talent-pool",
  "/settings",
  "/integrations",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    PUBLIC_EXACT.has(pathname) ||
    pathname.startsWith("/careers/") ||
    pathname.startsWith("/api/")
  ) {
    const res = NextResponse.next();
    applySecurityHeaders(res);
    return res;
  }
  const session = req.cookies.get("talentos_session")?.value;
  if (!session && PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    const res = NextResponse.redirect(url);
    applySecurityHeaders(res);
    return res;
  }
  const res = NextResponse.next();
  applySecurityHeaders(res);
  return res;
}

function applySecurityHeaders(res: NextResponse) {
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
