import { NextResponse, type NextRequest } from "next/server";

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
  matcher: ["/v/:path*", "/api/ext/:path*"],
};
