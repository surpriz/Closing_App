import { after, type NextRequest, NextResponse } from "next/server";

import { getPublicAppUrl } from "@/lib/app-origin";
import { logAudit } from "@/lib/audit";
import { getSellerPrefs, sellerTimezone } from "@/lib/closing/notify/preferences";
import { prisma } from "@/lib/db";
import { encodeCredentials } from "@/lib/mailboxes/credentials";
import { connectProviderMailbox } from "@/lib/mailboxes/connect";
import { isMicrosoftMailboxConfigured, mailboxWebhooksEnabled, mailboxWebhookUrl, oauthCallbackUrl } from "@/lib/mailboxes/config";
import { defaultPersist } from "@/lib/mailboxes";
import { isMailboxError } from "@/lib/mailboxes/errors";
import { graphConnector } from "@/lib/mailboxes/microsoft/graph";
import { exchangeCode } from "@/lib/mailboxes/microsoft/oauth";
import { consumeOauthState } from "@/lib/mailboxes/oauth/state";
import { clientStateFor } from "@/lib/mailboxes/webhooks/token";
import { requireOutreach } from "@/lib/outreach/flag";
import type { MicrosoftCredentials } from "@/lib/mailboxes/credentials";

const back = (query: string) => NextResponse.redirect(new URL(`/settings?${query}#boite`, getPublicAppUrl()));

export async function GET(request: NextRequest) {
  const { user, organization } = await requireOutreach();
  // Only `start` spends a mailboxConnect token; a refusal here lands on the settings page, not on JSON
  if (!isMicrosoftMailboxConfigured()) return back("mailbox=failed");

  const params = request.nextUrl.searchParams;
  const stateId = params.get("state");
  // Bound to the signed-in member: a state started by someone else is never used (login CSRF)
  const state = stateId
    ? await consumeOauthState(stateId, new Date(), { userId: user.id, organizationId: organization.id })
    : null;
  if (params.get("error")) return back("mailbox=cancelled");
  const code = params.get("code");
  if (!state || state.provider !== "MICROSOFT" || !state.codeVerifier || !code) return back("mailbox=expired");

  try {
    const tokens = await exchangeCode({ code, codeVerifier: state.codeVerifier, redirectUri: oauthCallbackUrl("microsoft") });
    const credentials: MicrosoftCredentials = {
      v: 1,
      kind: "microsoft",
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: new Date(Date.now() + tokens.expiresIn * 1000).toISOString(),
      tenantId: tokens.tenantId,
      scope: tokens.scope,
    };
    const probe = graphConnector(
      { id: "pending", provider: "MICROSOFT", connector: "GRAPH", email: "", displayName: null, credentials: "" },
      credentials,
    );
    const me = await probe.verify();
    if (!me.ok) return back(`mailbox=error&code=${me.code}`);

    const prefs = await getSellerPrefs(user.id, organization.id);
    const result = await connectProviderMailbox({
      organizationId: organization.id,
      userId: user.id,
      provider: "MICROSOFT",
      connector: "GRAPH",
      email: me.address,
      displayName: me.displayName,
      credentials,
      externalAccountId: null,
      timezone: sellerTimezone(prefs),
      reconnectMailboxId: state.redirectTo,
    });
    if (!result.ok) return back(`mailbox=error&code=${result.code}`);

    const mailboxId = result.mailboxId;
    if (mailboxWebhooksEnabled()) {
      after(async () => {
        try {
          const connector = graphConnector(
            { id: mailboxId, provider: "MICROSOFT", connector: "GRAPH", email: me.address, displayName: null, credentials: encodeCredentials(credentials) },
            credentials,
            { persistCredentials: defaultPersist(mailboxId) },
          );
          // A reconnect replaces the grant: drop the previous subscription so it cannot keep notifying
          const previous = await prisma.mailbox.findUnique({ where: { id: mailboxId }, select: { subscriptionId: true } });
          if (previous?.subscriptionId) await connector.unsubscribe!(previous.subscriptionId).catch(() => undefined);
          const sub = await connector.subscribe!({
            notificationUrl: mailboxWebhookUrl("microsoft"),
            clientState: clientStateFor(mailboxId),
          });
          await prisma.mailbox.update({
            where: { id: mailboxId },
            data: { subscriptionId: sub.subscriptionId, subscriptionExpiresAt: sub.expiresAt },
          });
        } catch (error) {
          // The poll still works; the renewal tick will try again
          console.error("[mailboxes] microsoft subscription failed", mailboxId, isMailboxError(error) ? error.code : "unknown");
        }
      });
    }
    await logAudit({
      organizationId: organization.id,
      actorUserId: user.id,
      action: "mailbox.connected",
      targetType: "mailbox",
      targetId: mailboxId,
      metadata: { provider: "MICROSOFT" },
    });
    return back("mailbox=connected");
  } catch (error) {
    if (isMailboxError(error)) return back(`mailbox=error&code=${error.code}`);
    console.error("[mailboxes] microsoft callback failed", error instanceof Error ? error.name : "unknown");
    return back("mailbox=error&code=TRANSIENT");
  }
}
