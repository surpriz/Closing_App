import { NextResponse, type NextRequest } from "next/server";

import { getPublicAppUrl } from "@/lib/app-origin";
import { gmailConnector } from "@/lib/mailboxes/config";
import { createHostedAuthLink } from "@/lib/mailboxes/gmail/unipile";
import { createOauthState } from "@/lib/mailboxes/oauth/state";
import { requireOutreach } from "@/lib/outreach/flag";
import { consumeLimit, tooManyRequests } from "@/lib/rate-limit";

/** Starts the Gmail connection through whichever connector is configured for new mailboxes. */
export async function GET(request: NextRequest) {
  const { user, organization } = await requireOutreach();
  if (!(await consumeLimit("mailboxConnect", request.headers, user.id))) return tooManyRequests();

  const connector = gmailConnector();
  if (!connector) return NextResponse.json({ error: "gmail_unavailable" }, { status: 404 });

  const settings = `${getPublicAppUrl()}/settings`;
  if (connector === "NYLAS") {
    // Wired by Task 5 (the Nylas pieces come from Task 4)
    return NextResponse.json({ error: "not_implemented" }, { status: 501 });
  }

  try {
    const state = await createOauthState({
      organizationId: organization.id,
      userId: user.id,
      provider: "GOOGLE",
      redirectTo: null,
    });
    const url = await createHostedAuthLink({
      stateId: state.id,
      type: "create",
      successUrl: `${settings}?mailbox=pending#boite`,
      failureUrl: `${settings}?mailbox=cancelled#boite`,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("[mailboxes] gmail start failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(`${settings}?mailbox=error#boite`, 302);
  }
}
