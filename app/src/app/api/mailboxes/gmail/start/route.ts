import { NextResponse, type NextRequest } from "next/server";

import { getPublicAppUrl } from "@/lib/app-origin";
import { canUseMailboxes } from "@/lib/billing/mailboxes";
import { prisma } from "@/lib/db";
import { gmailConnector } from "@/lib/mailboxes/config";
import { nylasAuthorizeUrl } from "@/lib/mailboxes/gmail/nylas";
import { createHostedAuthLink } from "@/lib/mailboxes/gmail/unipile";
import { createOauthState } from "@/lib/mailboxes/oauth/state";
import { requireOutreach } from "@/lib/outreach/flag";
import { consumeLimit, tooManyRequests } from "@/lib/rate-limit";

const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,255}$/;

/**
 * Starts the Gmail connection through whichever connector is configured for new mailboxes. `?mailboxId=` reconnects
 * one of the seller's own Google mailboxes (the state carries its id); `?login_hint=` pre-selects the account.
 */
export async function GET(request: NextRequest) {
  const { user, organization } = await requireOutreach();
  const settings = `${getPublicAppUrl()}/settings`;
  if (!(await consumeLimit("mailboxConnect", request.headers, user.id))) return tooManyRequests();

  // Reached from a link in the settings page: a browser lands back there, never on raw JSON
  const connector = gmailConnector();
  if (!connector) return NextResponse.redirect(`${settings}?mailbox=error&code=gmail_unavailable#boite`, 302);

  const params = request.nextUrl.searchParams;

  const asked = params.get("mailboxId");
  let reconnect: { id: string; email: string; connector: string; externalAccountId: string | null } | null = null;
  if (asked !== null) {
    if (!/^[\w-]{1,64}$/.test(asked)) return NextResponse.redirect(`${settings}?mailbox=error#boite`, 302);
    reconnect = await prisma.mailbox.findFirst({
      where: { id: asked, organizationId: organization.id, userId: user.id, provider: "GOOGLE" },
      select: { id: true, email: true, connector: true, externalAccountId: true },
    });
    if (!reconnect) return NextResponse.redirect(`${settings}?mailbox=error#boite`, 302);
  }
  // A mailbox keeps the connector it was created with: after GMAIL_CONNECTOR changes, reconnecting it is a plain
  // connection (the email upsert in connect.ts keeps the row)
  if (reconnect && reconnect.connector !== connector) reconnect = null;
  // A reconnect of the caller's own mailbox already counts; anything else creates one and needs the add-on
  if (!reconnect && !(await canUseMailboxes(organization.id))) {
    return NextResponse.redirect(`${settings}?mailbox=error&code=plan#boite`, 302);
  }
  const hint = params.get("login_hint");
  const loginHint = reconnect?.email ?? (hint && EMAIL.test(hint) ? hint : null);

  try {
    const state = await createOauthState({
      organizationId: organization.id,
      userId: user.id,
      provider: "GOOGLE",
      // Informational: the callback reconnects by email (connect.ts), not by this id
      redirectTo: reconnect?.id ?? null,
    });
    if (connector === "NYLAS") {
      return NextResponse.redirect(nylasAuthorizeUrl({ state: state.id, loginHint }), 302);
    }
    // Unipile's hosted link has no login hint: the account to reconnect is what pins the identity
    const url = await createHostedAuthLink({
      stateId: state.id,
      type: reconnect?.externalAccountId ? "reconnect" : "create",
      ...(reconnect?.externalAccountId ? { reconnectAccountId: reconnect.externalAccountId } : {}),
      successUrl: `${settings}?mailbox=pending#boite`,
      failureUrl: `${settings}?mailbox=cancelled#boite`,
    });
    return NextResponse.redirect(url, 302);
  } catch (error) {
    console.error("[mailboxes] gmail start failed", error instanceof Error ? error.message : "unknown");
    return NextResponse.redirect(`${settings}?mailbox=error#boite`, 302);
  }
}
