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

/** Selector and signing domain of the DKIM-Signature header. Header names are expected lowercased. */
export function dkimSignatureInfo(headers: Record<string, string>): { selector: string; domain: string } | null {
  const signature = headers["dkim-signature"];
  if (!signature) return null;
  const tag = (name: string) => new RegExp(`(?:^|;)\\s*${name}\\s*=\\s*([^;\\s]+)`, "i").exec(signature)?.[1]?.toLowerCase();
  const selector = tag("s");
  const domain = tag("d");
  return selector && domain ? { selector, domain } : null;
}

/** SES verdict status to a stored flag. Anything else (GRAY, PROCESSING_FAILED, absent) says nothing. */
export function verdictToBoolean(status: string | null | undefined): boolean | null {
  return status === "PASS" ? true : status === "FAIL" ? false : null;
}

export type ProbeOutcome = "recorded" | "wrong_sender" | "unknown_mailbox";

type Verdicts = { spf?: string | null; dkim?: string | null; dmarc?: string | null };

/** The signing domain must belong to the mailbox's domain: a PASS for someone else's key proves nothing about ours. */
function signedForDomain(signingDomain: string, mailboxDomain: string) {
  const d = mailboxDomain.toLowerCase();
  return signingDomain === d || signingDomain.endsWith(`.${d}`);
}

export async function recordDkimProbe(input: {
  mailboxId: string;
  fromEmail: string;
  verdicts: Verdicts;
  headers: Record<string, string>;
  now: Date;
}): Promise<ProbeOutcome> {
  const mailbox = await prisma.mailbox.findUnique({
    where: { id: input.mailboxId },
    select: { id: true, email: true, domain: true, dnsDetail: true },
  });
  if (!mailbox) return "unknown_mailbox";
  // The probe may only speak for the mailbox it was sent from
  if (input.fromEmail.trim().toLowerCase() !== mailbox.email.toLowerCase()) return "wrong_sender";

  const signature = dkimSignatureInfo(input.headers);
  const spf = verdictToBoolean(input.verdicts.spf);
  const dkim = verdictToBoolean(input.verdicts.dkim);
  const dmarc = verdictToBoolean(input.verdicts.dmarc);
  const dkimPass = dkim === true && !!signature && signedForDomain(signature.domain, mailbox.domain);

  const detail = (mailbox.dnsDetail && typeof mailbox.dnsDetail === "object" && !Array.isArray(mailbox.dnsDetail)
    ? mailbox.dnsDetail
    : {}) as Record<string, unknown>;
  const dkimDetail = (detail.dkim && typeof detail.dkim === "object" ? detail.dkim : {}) as Record<string, unknown>;
  const nextDetail = {
    ...detail,
    // The settings page reads the DKIM pill from the stored report, so a real PASS has to land there too
    ...(dkimPass ? { dkim: { ...dkimDetail, status: "verified", selector: signature.selector } } : {}),
    probe: {
      at: input.now.toISOString(),
      selector: signature?.selector ?? null,
      domain: signature?.domain ?? null,
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
