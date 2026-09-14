import type { NextRequest } from "next/server";

import { devMagicLinksEnabled, takeDevMagicLink } from "@/lib/dev-magic-links";

// Local dev only: hands the last magic link to the login page
export async function GET(request: NextRequest) {
  if (!devMagicLinksEnabled()) {
    return new Response("Not found", { status: 404 });
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email) return Response.json({ error: "email is required" }, { status: 400 });

  return Response.json({ url: takeDevMagicLink(email) });
}
