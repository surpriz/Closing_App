import { NextResponse, type NextRequest } from "next/server";

import { LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, isUiLocale } from "@/i18n/locale";

import {
  SIGNUP_SOURCE_COOKIE,
  SIGNUP_SOURCE_MAX_AGE,
  SOURCE_PARAMS,
  serializeSource,
  sourceFromParams,
} from "@/lib/acquisition";
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
  // The landing site links here with ?lang=en|fr and, from a campaign, ?offer= and utm_*:
  // remember them before sign-up, then drop them from the URL.
  const { searchParams } = request.nextUrl;
  const lang = searchParams.get("lang");
  const hasSourceParam = SOURCE_PARAMS.some((param) => searchParams.has(param));
  if ((lang !== null || hasSourceParam) && !request.nextUrl.pathname.startsWith("/api/")) {
    const source = sourceFromParams(searchParams, new Date());
    const url = request.nextUrl.clone();
    url.searchParams.delete("lang");
    for (const param of SOURCE_PARAMS) url.searchParams.delete(param);
    const response = NextResponse.redirect(url);
    if (lang !== null && isUiLocale(lang)) {
      response.cookies.set(LOCALE_COOKIE, lang, { maxAge: LOCALE_COOKIE_MAX_AGE, path: "/", sameSite: "lax" });
    }
    if (source) {
      response.cookies.set(SIGNUP_SOURCE_COOKIE, serializeSource(source), {
        httpOnly: true,
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
        maxAge: SIGNUP_SOURCE_MAX_AGE,
        path: "/",
      });
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
    // Pages reached with ?lang= or a campaign source from the landing site
    { source: "/((?!api|_next|.*\\..*).*)", has: [{ type: "query", key: "lang" }] },
    { source: "/((?!api|_next|.*\\..*).*)", has: [{ type: "query", key: "offer" }] },
    { source: "/((?!api|_next|.*\\..*).*)", has: [{ type: "query", key: "utm_source" }] },
    { source: "/((?!api|_next|.*\\..*).*)", has: [{ type: "query", key: "utm_medium" }] },
    { source: "/((?!api|_next|.*\\..*).*)", has: [{ type: "query", key: "utm_campaign" }] },
    { source: "/((?!api|_next|.*\\..*).*)", has: [{ type: "query", key: "utm_content" }] },
  ],
};
