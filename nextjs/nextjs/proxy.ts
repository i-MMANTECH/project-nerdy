import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_LOGIN_NEXT_HEADER, BILLING_SESSION_COOKIE_NAME } from "@/lib/billingCookies";

function hasSessionCookie(value: string | undefined) {
  return Boolean(value && value.includes("."));
}

function loginReturnPath(request: NextRequest): string {
  const { pathname, search } = request.nextUrl;
  return `${pathname}${search}`;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const protectedPrefixes = ["/admin", "/manager", "/reseller", "/dealer"];
  const needsAuth = protectedPrefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!needsAuth) {
    return NextResponse.next();
  }

  const returnPath = loginReturnPath(request);
  const token = request.cookies.get(BILLING_SESSION_COOKIE_NAME)?.value;

  if (pathname.startsWith("/admin")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set(ADMIN_LOGIN_NEXT_HEADER, returnPath);

    if (!hasSessionCookie(token)) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", returnPath);
      return NextResponse.redirect(url);
    }

    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  if (!hasSessionCookie(token)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", returnPath);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin",
    "/admin/:path*",
    "/manager",
    "/manager/:path*",
    "/reseller",
    "/reseller/:path*",
    "/dealer",
    "/dealer/:path*",
  ],
};
