import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

/** GET logout — clears session cookie and redirects to login (PHP-style bookmarkable URL). */
export async function GET(request: NextRequest) {
  await clearSession();
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "?logout=1";
  return NextResponse.redirect(url);
}
