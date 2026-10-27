import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

import { isPrivateAddress } from "@/lib/closing/channels/public-address";

import { MailboxError } from "./errors";

/** Error codes that mean "could not reach the server", shared by the IMAP and SMTP error mappers. */
export const NETWORK_CODES = /^(ECONNECTION|ETIMEDOUT|ESOCKET|EDNS|ECONNREFUSED|ECONNRESET|ENOTFOUND|EHOSTUNREACH|NoConnection)$/;

const ALLOWED_PORTS = { imap: [143, 993], smtp: [25, 465, 587, 2525] } as const;

const unsafe = () => new MailboxError("CONFIG", "mail server address is not allowed");

/**
 * Hosts and ports are typed by the seller, so without this a mailbox could be used to probe our internal network or
 * cloud metadata endpoints. Port and IP-literal checks run in every environment; DNS resolution is only done in
 * production (mirrors resolvesToPublicAddress, so local tests and dev against a localhost mail catcher keep working
 * except for the literal/localhost rules).
 *
 * Returns the address to connect to. In production this is the address we just validated: connecting to it directly
 * (with the original name kept for TLS SNI) closes the DNS-rebinding window between check and connect.
 */
export async function assertSafeMailHost(input: {
  host: string;
  port: number;
  kind: "imap" | "smtp";
}): Promise<{ address: string; servername: string | undefined }> {
  const host = input.host.trim().replace(/^\[|\]$/g, "");
  if (!(ALLOWED_PORTS[input.kind] as readonly number[]).includes(input.port)) throw unsafe();
  if (/^localhost$|\.localhost$/i.test(host)) throw unsafe();

  if (isIP(host) !== 0) {
    if (isPrivateAddress(host)) throw unsafe();
    return { address: host, servername: undefined };
  }
  if (process.env.NODE_ENV !== "production") return { address: host, servername: undefined };

  try {
    const found = await lookup(host, { all: true, verbatim: true });
    if (found.length === 0 || found.some(({ address }) => isPrivateAddress(address))) throw unsafe();
    return { address: found[0].address, servername: host };
  } catch (error) {
    throw error instanceof MailboxError ? error : unsafe();
  }
}
