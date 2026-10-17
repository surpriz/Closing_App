import { NextResponse, type NextRequest } from "next/server";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isUiLocale } from "@/i18n/locale";

import {
  VISITOR_COOKIE,
  VISITOR_COOKIE_MAX_AGE,
} from "@/lib/closing/tracking/visitor";

// /api/ext/* is called with a Bearer token, never cookies, so any origin may call it.
// The Outlook add-in's event runtime (classic Outlook on Windows) has no page origin of ours.
const EXT_CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function proxy(request: NextRequest) {
  // The landing site links here with ?lang=en|fr: remember it before sign-up, then drop it from the URL.
  const lang = request.nextUrl.searchParams.get("lang");
  if (lang !== null && !request.nextUrl.pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.searchParams.delete("lang");
    const response = NextResponse.redirect(url);
    if (isUiLocale(lang)) {
      response.cookies.set(LOCALE_COOKIE, lang, { maxAge: LOCALE_COOKIE_MAX_AGE, path: "/", sameSite: "lax" });
    }
    return response;
  }

  if (request.nextUrl.pathname.startsWith("/api/ext/")) {
    if (request.method === "OPTIONS") return new NextResponse(null, { status: 204, headers: EXT_CORS });
    const response = NextResponse.next();
    for (const [name, value] of Object.entries(EXT_CORS)) response.headers.set(name, value);
    return response;
  }

  // Give every proposal visitor a stable anonymous id before the viewer loads,
  // so parallel tracking calls agree on who is reading.
  const response = NextResponse.next();

  if (!request.cookies.has(VISITOR_COOKIE)) {
    response.cookies.set(VISITOR_COOKIE, crypto.randomUUID(), {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      maxAge: VISITOR_COOKIE_MAX_AGE,
      path: "/",
    });
  }

  return response;
}

export const config = {
  matcher: [
    "/v/:path*",
    "/api/ext/:path*",
    // Pages reached with ?lang= from the landing site
    { source: "/((?!api|_next|.*\\..*).*)", has: [{ type: "query", key: "lang" }] },
  ],
};
