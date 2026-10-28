import { type NextRequest, NextResponse } from "next/server";

import { getPublicAppUrl } from "@/lib/app-origin";
import { canUseMailboxes } from "@/lib/billing/mailboxes";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { isMicrosoftMailboxConfigured, oauthCallbackUrl } from "@/lib/mailboxes/config";
import { authorizeUrl } from "@/lib/mailboxes/microsoft/oauth";
import { createOauthState } from "@/lib/mailboxes/oauth/state";
import { requireOutreach } from "@/lib/outreach/flag";
import { consumeLimit, tooManyRequests } from "@/lib/rate-limit";

/** Sends the seller to Microsoft's consent screen. `?mailboxId=` marks a reconnection of one of their mailboxes. */
export async function GET(request: NextRequest) {
  const { user, organization } = await requireOutreach();
  if (!isMicrosoftMailboxConfigured()) return Response.json({ error: "Not found" }, { status: 404 });
  // A reconnect (?mailboxId=) keeps a mailbox that already counts: only a new one needs a plan with the add-on
  if (!request.nextUrl.searchParams.has("mailboxId") && !(await canUseMailboxes(organization.id))) {
    return NextResponse.redirect(`${getPublicAppUrl()}/settings?mailbox=error&code=plan#boite`, 302);
  }
  if (!(await consumeLimit("mailboxConnect", request.headers, user.id))) return tooManyRequests();

  const asked = request.nextUrl.searchParams.get("mailboxId");
  const mailbox =
    asked && /^[\w-]{1,64}$/.test(asked)
      ? await prisma.mailbox.findFirst({
          where: { id: asked, organizationId: organization.id, userId: user.id },
          select: { id: true, email: true },
        })
      : null;

  const state = await createOauthState({
    organizationId: organization.id,
    userId: user.id,
    provider: "MICROSOFT",
    redirectTo: mailbox?.id ?? null,
  });
  const url = authorizeUrl({
    clientId: getEnv().MICROSOFT_MAILBOX_CLIENT_ID as string,
    redirectUri: oauthCallbackUrl("microsoft"),
    state: state.id,
    codeChallenge: state.codeChallenge,
    loginHint: mailbox?.email,
  });
  return NextResponse.redirect(url);
}
