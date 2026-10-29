import { createHmac, timingSafeEqual } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/**
 * Honest DKIM check. A DNS lookup can only guess the selector; a real email cannot lie. The seller sends any
 * email from the mailbox to dkim-<mailboxId>.<signature>@<relay domain>, SES verifies it and tells us the
 * verdicts. The signed id means nobody can aim a probe at a mailbox they were not shown the address of.
 * Lowercase hex only: some mail servers lowercase the local part.
 */

const SIGNATURE_LENGTH = 12;

function sign(mailboxId: string, secret: string) {
  return createHmac("sha256", secret).update(`probe:${mailboxId}`).digest("hex").slice(0, SIGNATURE_LENGTH);
}

export function probeAddress(mailboxId: string, domain: string, secret: string) {
  return `dkim-${mailboxId}.${sign(mailboxId, secret)}@${domain}`;
}

/** The mailbox id behind a probe address, or null for any other address. */
export function parseProbeAddress(recipient: string, domain: string, secret: string): string | null {
  const match = /^dkim-([a-z0-9]{8,40})\.([0-9a-f]+)@(.+)$/.exec(recipient.trim().toLowerCase());
  if (!match || match[3] !== domain.toLowerCase()) return null;
  const [, mailboxId, given] = match;
  const expected = sign(mailboxId, secret);
  if (given.length !== expected.length || !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) return null;
  return mailboxId;
}

/** Selector and signing domain of one DKIM-Signature header value. */
export function dkimSignatureInfo(signature: string | undefined): { selector: string; domain: string } | null {
  if (!signature) return null;
  const tag = (name: string) => new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*([^;\\s]+)`, "i").exec(signature)?.[1]?.toLowerCase();
  const selector = tag("s");
  const domain = tag("d");
  return selector && domain ? { selector, domain } : null;
}

/**
 * The first signature made for the mailbox's own domain. A mail can carry several (the sender's and its
 * provider's) and the headers are not verified, so all of them are looked at, never just the last one.
 */
export function signatureForDomain(signatures: string[], mailboxDomain: string) {
  const d = mailboxDomain.toLowerCase();
  for (const raw of signatures) {
    const info = dkimSignatureInfo(raw);
    if (info && (info.domain === d || info.domain.endsWith(`.${d}`))) return info;
  }
  return null;
}

/** SES verdict status to a stored flag. Anything else (GRAY, PROCESSING_FAILED, absent) says nothing. */
export function verdictToBoolean(status: string | null | undefined): boolean | null {
  return status === "PASS" ? true : status === "FAIL" ? false : null;
}

export type ProbeOutcome = "recorded" | "wrong_sender" | "unknown_mailbox";

type Verdicts = { spf?: string | null; dkim?: string | null; dmarc?: string | null };

export async function recordDkimProbe(input: {
  mailboxId: string;
  fromEmail: string;
  verdicts: Verdicts;
  /** Every DKIM-Signature header value of the email, in order. */
  dkimSignatures: string[];
  now: Date;
}): Promise<ProbeOutcome> {
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: input.mailboxId },
    select: { id: true, email: true, domain: true, dnsDetail: true },
  });
  if (!mailbox) return "unknown_mailbox";
  // The probe may only speak for the mailbox it was sent from
  if (input.fromEmail.trim().toLowerCase() !== mailbox.email.toLowerCase()) return "wrong_sender";

  // A PASS only counts for our domain if one of the signatures is ours: a PASS for a relay's key proves nothing
  const signature = signatureForDomain(input.dkimSignatures, mailbox.domain);
  const firstSignature = signature ?? dkimSignatureInfo(input.dkimSignatures[0]);
  const spf = verdictToBoolean(input.verdicts.spf);
  const dkim = verdictToBoolean(input.verdicts.dkim);
  const dmarc = verdictToBoolean(input.verdicts.dmarc);
  const dkimPass = dkim === true && !!signature;

  const detail = (mailbox.dnsDetail && typeof mailbox.dnsDetail === "object" && !Array.isArray(mailbox.dnsDetail)
    ? mailbox.dnsDetail
    : {}) as Record<string, unknown>;
  const dkimDetail = (detail.dkim && typeof detail.dkim === "object" ? detail.dkim : {}) as Record<string, unknown>;
  const nextDetail = {
    ...detail,
    // The settings page reads the DKIM pill from the stored report, so a real PASS has to land there too
    // A FAIL is not proof of a revoked key: back to unknown, so the pill and the column agree
    ...(dkimPass
      ? { dkim: { ...dkimDetail, status: "verified", selector: signature.selector } }
      : dkim === false
        ? { dkim: { ...dkimDetail, status: "unknown", selector: null } }
        : {}),
    probe: {
      at: input.now.toISOString(),
      selector: firstSignature?.selector ?? null,
      domain: firstSignature?.domain ?? null,
      verified: dkimPass,
      dkim: input.verdicts.dkim ?? null,
      spf: input.verdicts.spf ?? null,
      dmarc: input.verdicts.dmarc ?? null,
    },
  };

  await prisma.mailbox.updateMany({
    where: { id: mailbox.id },
    data: {
      ...(spf !== null ? { spfOk: spf } : {}),
      ...(dkimPass ? { dkimOk: true } : dkim === false ? { dkimOk: false } : {}),
      ...(dmarc !== null ? { dmarcOk: dmarc } : {}),
      ...(signature && dkimPass ? { dkimSelector: signature.selector } : {}),
      dnsCheckedAt: input.now,
      dnsDetail: nextDetail as Prisma.InputJsonValue,
    },
  });
  return "recorded";
}
