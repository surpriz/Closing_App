import type { Prisma } from "@/generated/prisma/client";
import type { MailboxConnector as MailboxConnectorKind, MailboxProvider } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

import { localDayKey } from "./caps/allowance";
import { encodeCredentials, type ImapCredentials, type MailboxCredentials } from "./credentials";
import { runDnsChecks, detectMailbox, type DnsReport } from "./dns/checks";
import { nodeResolver, type DnsResolver } from "./dns/resolver";
import type { MailboxErrorCode } from "./errors";
import type { MailboxConnector, VerifyResult } from "./types";
import { imapConnector } from "./imap";
import { connectorFor } from "./index";
import { guessedPreset, presetFor, type PresetId } from "./presets";

type Endpoint = { host: string; port: number; secure: boolean };

const RAMP_RESET_AFTER_MS = 30 * 86_400_000;
/** Rule behind the `limit` error: at most this many live (active, error or connecting) mailboxes per seller. */
export const MAX_MAILBOXES_PER_USER = 3;
const LIVE = ["ACTIVE", "ERROR", "CONNECTING"] as const;

export function domainOf(email: string) {
  return email.slice(email.lastIndexOf("@") + 1).trim().toLowerCase();
}

export type MailboxDetection = {
  domain: string;
  provider: MailboxProvider;
  preset: PresetId | null;
  mxHost: string | null;
  suggested: { imap: Endpoint; smtp: Endpoint } | null;
  hint: "app_password" | "mailbox_password" | null;
};

export async function detectMailboxFor(email: string, resolver: DnsResolver = nodeResolver()): Promise<MailboxDetection> {
  const domain = domainOf(email);
  let found: Awaited<ReturnType<typeof detectMailbox>>;
  try {
    found = await detectMailbox(domain, resolver);
  } catch {
    // A DNS hiccup must not block the form: fall back to the generic guess
    found = { provider: "IMAP", preset: null, mxHost: null };
  }
  const preset = presetFor(found.preset);
  const hasHosts = preset && preset.imap.host;
  // Microsoft has no usable IMAP password flow: no suggestion, the form stays closed
  const suggested =
    found.provider === "MICROSOFT" ? null : hasHosts ? { imap: preset.imap, smtp: preset.smtp } : guessedPreset(domain);
  return { domain, ...found, suggested, hint: preset?.hint ?? null };
}

function dnsFields(report: DnsReport) {
  return {
    spfOk: report.spf.status === "ok" ? true : report.spf.status === "unknown_provider" ? null : false,
    dkimOk: report.dkim.status === "verified" ? true : report.dkim.status === "revoked" ? false : null,
    dmarcOk: report.dmarc.status !== "missing", // p=none is a published policy
    dkimSelector: report.dkim.selector,
    dnsDetail: report as unknown as Prisma.InputJsonValue,
    dnsCheckedAt: new Date(report.checkedAt),
  };
}

const PROBE_TRUST_MS = 90 * 24 * 60 * 60 * 1000;

/**
 * A DNS re-check only guesses the DKIM selector, a probe email proved the real signature. So a recent verified probe
 * survives a DNS "unknown" (and the probe stays on the report); a DNS "verified" or "revoked" always wins.
 */
function withProbe(report: DnsReport, stored: unknown, now: Date) {
  const probe = (stored as { probe?: { at?: string; verified?: boolean; selector?: string | null } } | null)?.probe;
  if (!probe) return { report: report as DnsReport & { probe?: unknown }, kept: false };
  const merged: DnsReport & { probe?: unknown } = { ...report, probe };
  const fresh = !!probe.at && now.getTime() - new Date(probe.at).getTime() <= PROBE_TRUST_MS;
  if (report.dkim.status === "unknown" && probe.verified === true && fresh) {
    merged.dkim = { status: "verified", selector: probe.selector ?? null };
    return { report: merged, kept: true };
  }
  return { report: merged, kept: false };
}

function unknownReport(now: Date): DnsReport {
  return {
    spf: { status: "unknown_provider", record: null },
    dmarc: { status: "missing", policy: null },
    dkim: { status: "unknown", selector: null },
    checkedAt: now.toISOString(),
  };
}

/** A DNS outage never blocks a connection or a re-check button: the report just says "unknown". */
async function safeReport(
  input: { domain: string; provider: MailboxProvider; preset: PresetId | null; knownSelector?: string | null },
  resolver: DnsResolver,
  now: Date,
): Promise<DnsReport> {
  try {
    return await runDnsChecks({ ...input, resolver, now });
  } catch {
    return unknownReport(now);
  }
}

export type ConnectInput = {
  organizationId: string;
  userId: string;
  email: string;
  displayName: string | null;
  timezone: string;
  imap: Endpoint;
  smtp: Endpoint;
  password: string;
  user?: string;
};

export type ConnectResult =
  | { ok: true; mailboxId: string; dns: DnsReport }
  | { ok: false; code: MailboxErrorCode | "exists" | "limit"; message: string };

type SharedConnect = {
  organizationId: string;
  userId: string;
  email: string;
  displayName: string | null;
  timezone: string;
  connector: MailboxConnectorKind;
  externalAccountId?: string | null;
  /** Built only once the guards passed; may fix the provider from what DNS detection found */
  prepare: () => { creds: MailboxCredentials; verify: () => Promise<VerifyResult> };
  providerFor: (detected: { provider: MailboxProvider; preset: PresetId | null }) => MailboxProvider;
  /** Provider the DNS report is read for: IMAP mailboxes are checked against what the MX says (SPF includes, DKIM selectors) */
  reportProvider: (detected: { provider: MailboxProvider }) => MailboxProvider;
};

/** The guards, verification, DNS report and upsert both the IMAP and the OAuth paths share. */
async function connectMailbox(
  input: SharedConnect,
  deps: { resolver?: DnsResolver; now?: Date },
): Promise<ConnectResult> {
  const resolver = deps.resolver ?? nodeResolver();
  const now = deps.now ?? new Date();
  const email = input.email.trim().toLowerCase();
  const domain = domainOf(email);
  const displayName = input.displayName?.trim() || null;

  const existing = await prisma.mailbox.findUnique({
    where: { organizationId_email: { organizationId: input.organizationId, email } },
    select: { id: true, status: true, disconnectedAt: true, userId: true, connector: true },
  });
  // The owner of a mailbox in ERROR can reconnect it (fix a password, re-consent) without hitting "exists" or the limit
  const reconnecting = existing?.status === "ERROR" && existing.userId === input.userId;
  if (existing && (LIVE as readonly string[]).includes(existing.status) && !reconnecting) {
    return { ok: false, code: "exists", message: "mailbox already connected" };
  }
  // A reconnect replaces a mailbox that already counts, so only new ones hit the per-member cap
  if (!reconnecting) {
    const live = await prisma.mailbox.count({
      where: { organizationId: input.organizationId, userId: input.userId, status: { in: [...LIVE] } },
    });
    if (live >= MAX_MAILBOXES_PER_USER) return { ok: false, code: "limit", message: "too many mailboxes" };
  }

  const { creds, verify } = input.prepare();
  const verified = await verify();
  if (!verified.ok) return { ok: false, code: verified.code, message: verified.message };

  let detected: Awaited<ReturnType<typeof detectMailbox>>;
  try {
    detected = await detectMailbox(domain, resolver);
  } catch {
    detected = { provider: "IMAP", preset: null, mxHost: null };
  }
  const provider = input.providerFor(detected);
  const dns = await safeReport({ domain, provider: input.reportProvider(detected), preset: detected.preset }, resolver, now);
  const credentials = encodeCredentials(creds);

  const fields = {
    provider,
    connector: input.connector,
    domain,
    displayName,
    credentials,
    status: "ACTIVE" as const,
    lastError: null,
    lastErrorAt: null,
    errorNotifiedAt: null,
    disconnectedAt: null,
    timezone: input.timezone,
    syncErrorCount: 0,
    ...(input.externalAccountId !== undefined ? { externalAccountId: input.externalAccountId } : {}),
    ...dnsFields(dns),
  };
  // Taking over a disconnected mailbox is accepted (any member may reconnect it); after a month off the warm-up ramp restarts
  const stale = existing?.disconnectedAt && now.getTime() - existing.disconnectedAt.getTime() > RAMP_RESET_AFTER_MS;
  const mailbox = await prisma.mailbox.upsert({
    where: { organizationId_email: { organizationId: input.organizationId, email } },
    create: { organizationId: input.organizationId, userId: input.userId, email, rampStartedAt: now, dailyCap: getEnv().MAILBOX_DAILY_CAP_DEFAULT, ...fields },
    // A cursor only means something to the connector that wrote it (IMAP uid, Graph deltaLink, intermediary date)
    update: {
      userId: input.userId,
      ...(stale ? { rampStartedAt: now } : {}),
      ...(existing && existing.connector !== input.connector ? { syncCursor: null } : {}),
      ...fields,
    },
    select: { id: true },
  });
  return { ok: true, mailboxId: mailbox.id, dns };
}

export async function connectImapMailbox(
  input: ConnectInput,
  deps: { resolver?: DnsResolver; now?: Date } = {},
): Promise<ConnectResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || null;
  return connectMailbox(
    {
      organizationId: input.organizationId,
      userId: input.userId,
      email,
      displayName,
      timezone: input.timezone,
      connector: "SMTP",
      prepare: () => {
        const user = input.user?.trim() || email;
        const creds: ImapCredentials = {
          v: 1,
          kind: "imap",
          imap: { ...input.imap, user, pass: input.password },
          smtp: { ...input.smtp, user, pass: input.password },
        };
        return { creds, verify: () => imapConnector({ email, displayName }, creds).verify() };
      },
      providerFor: (detected) => (detected.preset === "gmail-app-password" ? "GOOGLE" : "IMAP"),
      reportProvider: (detected) => detected.provider,
    },
    deps,
  );
}

export type ProviderConnectInput = {
  organizationId: string;
  userId: string;
  provider: MailboxProvider;
  connector: MailboxConnectorKind;
  email: string;
  displayName: string | null;
  credentials: MailboxCredentials;
  externalAccountId: string | null;
  timezone: string;
  reconnectMailboxId?: string | null;
};

/**
 * OAuth mailboxes (Microsoft, Gmail through a connector): same rules as IMAP (exists, per-member limit, owner
 * reconnect, takeover of a disconnected one). The provider is the one the seller chose, DNS only feeds the report.
 * A reconnect is recognised by the email, like IMAP; `reconnectMailboxId` only comes from the UI for context.
 */
export async function connectProviderMailbox(
  input: ProviderConnectInput,
  deps: {
    resolver?: DnsResolver;
    now?: Date;
    verify?: (connector: MailboxConnector) => Promise<VerifyResult>;
  } = {},
): Promise<ConnectResult> {
  const email = input.email.trim().toLowerCase();
  const displayName = input.displayName?.trim() || null;
  return connectMailbox(
    {
      organizationId: input.organizationId,
      userId: input.userId,
      email,
      displayName,
      timezone: input.timezone,
      connector: input.connector,
      externalAccountId: input.externalAccountId,
      prepare: () => ({
        creds: input.credentials,
        verify: () => {
          const connector = connectorFor(
            {
              id: input.reconnectMailboxId ?? "pending",
              provider: input.provider,
              connector: input.connector,
              email,
              displayName,
              credentials: encodeCredentials(input.credentials),
              externalAccountId: input.externalAccountId,
            },
            {},
          );
          return deps.verify ? deps.verify(connector) : connector.verify();
        },
      }),
      providerFor: () => input.provider,
      reportProvider: () => input.provider,
    },
    deps,
  );
}

/**
 * Best effort: asks the provider to drop the grant (Graph subscription, Unipile account, Nylas grant) before the
 * credentials are wiped. A failure never blocks the disconnection.
 */
async function revokeAtProvider(where: { id: string; organizationId: string; userId?: string }) {
  try {
    const mailbox = await prisma.mailbox.findFirst({
      where: { ...where, status: { not: "DISCONNECTED" } },
      select: {
        id: true,
        provider: true,
        connector: true,
        email: true,
        displayName: true,
        credentials: true,
        externalAccountId: true,
        subscriptionId: true,
      },
    });
    if (!mailbox?.credentials) return;
    // One Google account connected in two workspaces shares one grant/account: deleting it would cut the other
    if ((mailbox.connector === "NYLAS" || mailbox.connector === "UNIPILE") && mailbox.externalAccountId) {
      const others = await prisma.mailbox.count({
        where: {
          id: { not: mailbox.id },
          connector: mailbox.connector,
          externalAccountId: mailbox.externalAccountId,
          status: { not: "DISCONNECTED" },
        },
      });
      if (others > 0) return;
    }
    await connectorFor(mailbox).disconnect();
  } catch (error) {
    console.error("[mailboxes] provider revocation failed", where.id, error instanceof Error ? error.message : "unknown");
  }
}

/** Credentials are wiped, not just the status flipped: a disconnected mailbox keeps no secret. */
export async function disconnectMailbox(organizationId: string, userId: string, mailboxId: string, now = new Date()) {
  await revokeAtProvider({ id: mailboxId, organizationId, userId });
  const { count } = await prisma.mailbox.updateMany({
    where: { id: mailboxId, organizationId, userId, status: { not: "DISCONNECTED" } },
    data: { status: "DISCONNECTED", disconnectedAt: now, credentials: "" },
  });
  return count > 0;
}

export async function recheckMailboxDns(
  organizationId: string,
  userId: string,
  mailboxId: string,
  resolver: DnsResolver = nodeResolver(),
  now = new Date(),
) {
  const mailbox = await prisma.mailbox.findFirst({
    where: { id: mailboxId, organizationId, userId, status: { not: "DISCONNECTED" } },
    select: { id: true, domain: true, provider: true, dkimSelector: true, dnsDetail: true },
  });
  if (!mailbox) return null;
  let preset: PresetId | null = null;
  try {
    preset = (await detectMailbox(mailbox.domain, resolver)).preset;
  } catch {
    // keep the provider-level checks
  }
  const report = await safeReport(
    { domain: mailbox.domain, provider: mailbox.provider, preset, knownSelector: mailbox.dkimSelector },
    resolver,
    now,
  );
  const merged = withProbe(report, mailbox.dnsDetail, now);
  await prisma.mailbox.update({
    where: { id: mailbox.id },
    data: { ...dnsFields(merged.report), ...(merged.kept ? { dkimOk: true } : {}) },
  });
  return merged.report;
}

export async function updateMailboxCap(organizationId: string, userId: string, mailboxId: string, cap: number) {
  const dailyCap = Math.min(Math.max(Math.trunc(cap), 1), getEnv().MAILBOX_DAILY_CAP_MAX);
  const { count } = await prisma.mailbox.updateMany({
    where: { id: mailboxId, organizationId, userId, status: { not: "DISCONNECTED" } },
    data: { dailyCap },
  });
  if (count === 0) return null;
  const mailbox = await prisma.mailbox.findFirst({ where: { id: mailboxId, organizationId, userId }, select: { email: true } });
  return { cap: dailyCap, email: mailbox?.email ?? null };
}

/** "Sent today" as shown in settings: a count from another local day reads as zero. */
export function sentToday(m: { sentDay: string | null; sentCount: number; timezone: string }, now: Date) {
  return m.sentDay === localDayKey(now, m.timezone) ? m.sentCount : 0;
}
