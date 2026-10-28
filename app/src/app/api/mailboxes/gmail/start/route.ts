import { NextResponse, type NextRequest } from "next/server";

import { getPublicAppUrl } from "@/lib/app-origin";
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
  if (!(await consumeLimit("mailboxConnect", request.headers, user.id))) return tooManyRequests();

  const connector = gmailConnector();
  if (!connector) return NextResponse.json({ error: "gmail_unavailable" }, { status: 404 });

  const settings = `${getPublicAppUrl()}/settings`;
  const params = request.nextUrl.searchParams;

  const asked = params.get("mailboxId");
  let reconnect: { id: string; email: string; externalAccountId: string | null } | null = null;
  if (asked !== null) {
    if (!/^[\w-]{1,64}$/.test(asked)) return NextResponse.redirect(`${settings}?mailbox=error#boite`, 302);
    reconnect = await prisma.mailbox.findFirst({
      where: { id: asked, organizationId: organization.id, userId: user.id, provider: "GOOGLE" },
      select: { id: true, email: true, externalAccountId: true },
    });
    if (!reconnect) return NextResponse.redirect(`${settings}?mailbox=error#boite`, 302);
  }
  const hint = params.get("login_hint");
  const loginHint = reconnect?.email ?? (hint && EMAIL.test(hint) ? hint : null);

  try {
    const state = await createOauthState({
      organizationId: organization.id,
      userId: user.id,
      provider: "GOOGLE",
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
