import type { NextRequest } from "next/server";

import { getPublicAppUrl } from "@/lib/app-origin";
import { handleNylasCallback } from "@/lib/mailboxes/oauth/nylas-callback";
import { requireOutreach } from "@/lib/outreach/flag";
import { consumeLimit, tooManyRequests } from "@/lib/rate-limit";

/** Nylas sends the seller back here with `code` and our `state`. */
export async function GET(request: NextRequest) {
  const { user, organization } = await requireOutreach();
  if (!(await consumeLimit("mailboxConnect", request.headers, user.id))) return tooManyRequests();
  const params = request.nextUrl.searchParams;
  const path = await handleNylasCallback({
    code: params.get("code"),
    state: params.get("state"),
    error: params.get("error"),
    user,
    organizationId: organization.id,
  });
  return Response.redirect(new URL(path, getPublicAppUrl()), 302);
}
