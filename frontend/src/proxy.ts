import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Preserve SEO URLs from WordPress:
 * - strip trailing slash (except root)
 * - strip legacy permalink "%20" / trailing space artifact
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  let pathname = url.pathname;

  if (pathname.includes("%20") || pathname.endsWith("/ ") || pathname.endsWith("/\u00a0")) {
    pathname = pathname.replace(/%20/g, "").replace(/\/+$/, "");
    url.pathname = pathname || "/";
    return NextResponse.redirect(url, 308);
  }

  if (pathname.length > 1 && pathname.endsWith("/")) {
    url.pathname = pathname.replace(/\/+$/, "");
    return NextResponse.redirect(url, 308);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
