import { prisma } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getSellerPrefs, sellerTimezone } from "@/lib/closing/notify/preferences";

import { connectProviderMailbox } from "../connect";
import { getUnipileAccount, unipileConnector } from "../gmail/unipile";
import type { ConnectorDeps } from "../index";
import { notifyMailboxOwner } from "../notify-owner";
import { consumeOauthState } from "../oauth/state";
import { verifyUnipileHeaderToken } from "./unipile-secrets";

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

/** Unipile cannot sign: a derived secret also arrives as a custom header, so a leaked URL alone is not enough. */
export function hasUnipileHeaderToken(request: Request): boolean {
  try {
    return verifyUnipileHeaderToken(request.headers.get("x-clozer-token"));
  } catch {
    return false;
  }
}

export type NotifyOutcome = "connected" | "ignored" | "invalid_state" | "failed";

/** Hosted-auth callback. The state is consumed first so a replay can never create a second mailbox. */
export async function handleUnipileNotify(
  payload: unknown,
  deps: Pick<ConnectorDeps, "http"> & { now?: Date } = {},
): Promise<{ outcome: NotifyOutcome; mailboxId?: string }> {
  const body = obj(payload);
  const status = str(body.status);
  const accountId = str(body.account_id);
  const stateId = str(body.name);
  if ((status !== "CREATION_SUCCESS" && status !== "RECONNECTED") || !accountId || !stateId) return { outcome: "ignored" };

  // Checked before the state is spent: a forged notification must not burn someone's pending connection, and
  // nothing is deleted for an account we could not tie to this state
  let account: Awaited<ReturnType<typeof getUnipileAccount>>;
  try {
    account = await getUnipileAccount(accountId, deps);
  } catch (error) {
    console.error("[mailboxes] unipile account lookup failed", error instanceof Error ? error.message : "unknown");
    return { outcome: "failed" };
  }
  if (account.name !== stateId) {
    console.error("[mailboxes] unipile account does not match the state");
    return { outcome: "invalid_state" };
  }

  const state = await consumeOauthState(stateId, deps.now);
  if (!state) {
    // Made for this state, which expired or was spent: nobody will claim the account, it would linger connected and
    // billed. The orphan guard keeps it when a mailbox already points at it (a replayed notification)
    await dropOrphanAccount(accountId, deps);
    return { outcome: "invalid_state" };
  }
  if (state.provider !== "GOOGLE") return { outcome: "invalid_state" };

  try {
    // Another workspace already runs this account: never let a second one take it over
    const taken = await prisma.mailbox.findFirst({
      where: {
        connector: "UNIPILE",
        externalAccountId: accountId,
        status: { in: ["ACTIVE", "ERROR", "CONNECTING"] },
        organizationId: { not: state.organizationId },
      },
      select: { id: true },
    });
    if (taken) {
      console.error("[mailboxes] unipile account already used elsewhere");
      return { outcome: "failed" };
    }
    if (!account.address) {
      console.error("[mailboxes] unipile account without an address");
      await dropOrphanAccount(accountId, deps);
      return { outcome: "failed" };
    }
    const email = account.address.trim().toLowerCase();
    const previous = await prisma.mailbox.findUnique({
      where: { organizationId_email: { organizationId: state.organizationId, email } },
      select: { connector: true, externalAccountId: true },
    });
    const prefs = await getSellerPrefs(state.userId, state.organizationId);
    const result = await connectProviderMailbox(
      {
        organizationId: state.organizationId,
        userId: state.userId,
        provider: "GOOGLE",
        connector: "UNIPILE",
        email,
        displayName: null,
        credentials: { v: 1, kind: "unipile", accountId },
        externalAccountId: accountId,
        timezone: sellerTimezone(prefs),
      },
      { now: deps.now },
    );
    if (!result.ok) {
      console.error("[mailboxes] unipile connect refused", result.code);
      await dropOrphanAccount(accountId, deps);
      return { outcome: "failed" };
    }
    await logAudit({
      organizationId: state.organizationId,
      actorUserId: state.userId,
      action: "mailbox.connected",
      targetType: "mailbox",
      targetId: result.mailboxId,
      metadata: { provider: "GOOGLE", connector: "UNIPILE" },
    });
    // A reconnect that came back with a new account leaves the old one billed and listening
    if (previous?.connector === "UNIPILE" && previous.externalAccountId && previous.externalAccountId !== accountId) {
      await dropOrphanAccount(previous.externalAccountId, deps);
    }
    return { outcome: "connected", mailboxId: result.mailboxId };
  } catch (error) {
    console.error("[mailboxes] unipile notify failed", error instanceof Error ? error.message : "unknown");
    await dropOrphanAccount(accountId, deps);
    return { outcome: "failed" };
  }
}

/** Deletes a Unipile account no mailbox points at (best effort): otherwise it would linger, connected and billed. */
export async function dropOrphanAccount(accountId: string, deps: Pick<ConnectorDeps, "http"> = {}) {
  try {
    const used = await prisma.mailbox.findFirst({
      where: { connector: "UNIPILE", externalAccountId: accountId },
      select: { id: true },
    });
    if (used) return;
    await unipileConnector({ email: "", displayName: null }, { v: 1, kind: "unipile", accountId }, deps).disconnect();
  } catch (error) {
    console.error("[mailboxes] unipile orphan cleanup failed", error instanceof Error ? error.message : "unknown");
  }
}

export type EventOutcome =
  | { action: "sync"; mailboxId: string }
  | { action: "auth_revoked"; mailboxId: string }
  | { action: "none" };

/**
 * Normalises the two payload shapes we expect (flat `{ event, account_id }` or Unipile's `{ AccountStatus: {…} }`);
 * kept in one place because the account-status shape is spike-verified.
 */
function readEvent(payload: unknown) {
  const body = obj(payload);
  const nested = obj(body.AccountStatus);
  const event = str(body.event) ?? (Object.keys(nested).length ? "account_status" : null);
  const accountId = str(body.account_id) ?? str(nested.account_id);
  const status = str(body.status) ?? str(nested.message) ?? str(nested.status);
  return { event, accountId, status };
}

/** The payload is only a trigger: it names an account, never content. Unknown shapes and accounts do nothing. */
export async function handleUnipileEvent(
  payload: unknown,
  now = new Date(),
  deps: Pick<ConnectorDeps, "http"> = {},
): Promise<EventOutcome> {
  const { event, accountId, status } = readEvent(payload);
  if (!event || !accountId) return { action: "none" };
  const mailbox = await prisma.mailbox.findFirst({
    where: { connector: "UNIPILE", externalAccountId: accountId, status: { not: "DISCONNECTED" } },
    select: { id: true, status: true },
  });
  if (!mailbox) return { action: "none" };

  if (event === "mail_received") {
    if (mailbox.status !== "ACTIVE") return { action: "none" };
    await prisma.mailbox.update({ where: { id: mailbox.id }, data: { syncRequestedAt: now } });
    return { action: "sync", mailboxId: mailbox.id };
  }
  if (event === "account_status" && (status === "CREDENTIALS" || status === "DISCONNECTED")) {
    // The payload is only a hint: our own call to Unipile decides
    const live = await getUnipileAccount(accountId, deps).catch(() => null);
    if (!live?.status || !/CREDENTIALS|DISCONNECTED|PERMISSIONS/i.test(live.status)) return { action: "none" };
    const detail = `unipile ${live.status}`;
    const { count } = await prisma.mailbox.updateMany({
      where: { id: mailbox.id, status: "ACTIVE" },
      data: { status: "ERROR", lastError: `AUTH_REVOKED: ${detail}`, lastErrorAt: now },
    });
    if (count === 0) return { action: "none" };
    await notifyMailboxOwner(mailbox.id, "auth_revoked", detail, now);
    return { action: "auth_revoked", mailboxId: mailbox.id };
  }
  return { action: "none" };
}
