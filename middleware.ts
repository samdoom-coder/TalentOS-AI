import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Frontend routing-level guard (never the only authorization — every API
// re-validates session + org membership server-side).
const PUBLIC = ["/", "/login", "/signup", "/forgot-password", "/careers"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith("/careers/") || pathname.startsWith("/api/"))) {
    return NextResponse.next();
  }
  const session = req.cookies.get("talentos_session")?.value;
  if (!session && (pathname.startsWith("/dashboard") || pathname.startsWith("/candidate") || pathname.startsWith("/admin"))) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
