import { timingSafeEqual } from "node:crypto";

import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { logAudit } from "@/lib/audit";
import { getSellerPrefs, sellerTimezone } from "@/lib/closing/notify/preferences";

import { connectProviderMailbox } from "../connect";
import { getUnipileAccount } from "../gmail/unipile";
import type { ConnectorDeps } from "../index";
import { notifyMailboxOwner } from "../notify-owner";
import { consumeOauthState } from "../oauth/state";

type Json = Record<string, unknown>;

function obj(value: unknown): Json {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Json) : {};
}

function str(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

/** Unipile cannot sign: the same token also arrives as a custom header, so a leaked URL alone is not enough. */
export function hasUnipileHeaderToken(request: Request, env: ReturnType<typeof getEnv> = getEnv()): boolean {
  const secret = env.MAILBOX_WEBHOOK_TOKEN;
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("x-clozer-token") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
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

  const state = await consumeOauthState(stateId, deps.now);
  if (!state) return { outcome: "invalid_state" };

  try {
    const account = await getUnipileAccount(accountId, deps);
    if (!account.address) {
      console.error("[mailboxes] unipile account without an address");
      return { outcome: "failed" };
    }
    const prefs = await getSellerPrefs(state.userId, state.organizationId);
    const result = await connectProviderMailbox(
      {
        organizationId: state.organizationId,
        userId: state.userId,
        provider: "GOOGLE",
        connector: "UNIPILE",
        email: account.address,
        displayName: null,
        credentials: { v: 1, kind: "unipile", accountId },
        externalAccountId: accountId,
        timezone: sellerTimezone(prefs),
      },
      { now: deps.now },
    );
    if (!result.ok) {
      console.error("[mailboxes] unipile connect refused", result.code);
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
    return { outcome: "connected", mailboxId: result.mailboxId };
  } catch (error) {
    console.error("[mailboxes] unipile notify failed", error instanceof Error ? error.message : "unknown");
    return { outcome: "failed" };
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
export async function handleUnipileEvent(payload: unknown, now = new Date()): Promise<EventOutcome> {
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
    const detail = `unipile ${status}`;
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
