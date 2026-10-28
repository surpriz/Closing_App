import { logAudit } from "@/lib/audit";
import { getSellerPrefs, sellerTimezone } from "@/lib/closing/notify/preferences";
import { connectProviderMailbox } from "../connect";
import { isMailboxError } from "../errors";
import { exchangeNylasCode } from "../gmail/nylas";
import { consumeOauthState } from "./state";

export type NylasCallbackParams = {
  code: string | null;
  state: string | null;
  error: string | null;
  user: { id: string };
  organizationId: string;
};

export type NylasCallbackDeps = {
  consumeState: typeof consumeOauthState;
  exchange: typeof exchangeNylasCode;
  connect: typeof connectProviderMailbox;
  timezone: (userId: string, organizationId: string) => Promise<string>;
  audit: typeof logAudit;
  now: () => Date;
};

const defaults: NylasCallbackDeps = {
  consumeState: consumeOauthState,
  exchange: exchangeNylasCode,
  connect: connectProviderMailbox,
  timezone: async (userId, organizationId) => sellerTimezone(await getSellerPrefs(userId, organizationId)),
  audit: logAudit,
  now: () => new Date(),
};

/** Where to send the seller back to. Never throws: every failure becomes a `mailbox=` flag on the settings page. */
export async function handleNylasCallback(params: NylasCallbackParams, deps: Partial<NylasCallbackDeps> = {}): Promise<string> {
  const d = { ...defaults, ...deps };
  const to = (flag: string) => `/settings?mailbox=${flag}#boite`;

  // Bound to the signed-in member: a state started by someone else must never be usable (login CSRF). Consumed before
  // anything else, a cancelled consent included, so it can never be replayed
  const expected = { userId: params.user.id, organizationId: params.organizationId };
  const state = params.state ? await d.consumeState(params.state, d.now(), expected) : null;
  if (params.error) return to("cancelled");
  if (!params.code || !state || state.userId !== expected.userId || state.organizationId !== expected.organizationId || state.provider !== "GOOGLE") {
    return to("expired");
  }
  try {
    const { grantId, email } = await d.exchange(params.code);
    const result = await d.connect({
      organizationId: state.organizationId,
      userId: state.userId,
      provider: "GOOGLE",
      connector: "NYLAS",
      email,
      displayName: null,
      credentials: { v: 1, kind: "nylas", grantId },
      externalAccountId: grantId,
      timezone: await d.timezone(state.userId, state.organizationId),
    });
    if (!result.ok) return to(`error&code=${result.code}`);
    await d.audit({
      organizationId: state.organizationId,
      actorUserId: state.userId,
      action: "mailbox.connected",
      targetType: "mailbox",
      targetId: result.mailboxId,
      metadata: { email },
    });
    return to("connected");
  } catch (error) {
    if (isMailboxError(error)) return to(`error&code=${error.code}`);
    console.error("[mailboxes] nylas callback failed", error instanceof Error ? error.message : "unknown");
    return to("error&code=TRANSIENT");
  }
}
