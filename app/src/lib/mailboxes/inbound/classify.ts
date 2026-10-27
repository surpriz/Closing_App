import type { DsnDetails } from "../types";

export type DsnClass = "permanent" | "permanent_message" | "transient" | "policy" | "ignore";

const PERMANENT_STATUS = new Set(["5.1.0", "5.1.1", "5.1.2", "5.1.3", "5.1.6", "5.1.10", "5.2.1"]);
const UNKNOWN_USER = /user unknown|does not exist|recipientnotfound/i;
const POLICY_WORDS = /blocked|spam|dmarc|policy|reputation/i;

/**
 * What a bounce means for the sequence. Pure.
 * permanent: the address is dead. permanent_message: this message was refused, the address is fine.
 * transient: retry later. policy: our side (reputation, auth), not the prospect's address.
 */
export function classifyDsn(d: DsnDetails): DsnClass {
  const diagnostic = d.diagnostic ?? "";
  const status = d.status;

  if (!status) return UNKNOWN_USER.test(diagnostic) ? "permanent" : "ignore";

  if (d.action === "delayed" || status.startsWith("4.") || status === "5.2.2") return "transient";
  if (status === "5.2.3") return "permanent_message";
  if (PERMANENT_STATUS.has(status)) return "permanent";
  if (status === "5.4.1" && /recipient address rejected/i.test(diagnostic)) return "permanent";
  if (status === "5.5.0" && /mailbox unavailable/i.test(diagnostic)) return "permanent";
  if (status.startsWith("5.7.") || POLICY_WORDS.test(diagnostic)) return "policy";
  return "ignore";
}
