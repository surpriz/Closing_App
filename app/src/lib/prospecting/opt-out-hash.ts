// Values of the global opt-out list, normalized then hashed: the list never holds an address.
import { createHash } from "node:crypto";

import { normalizeLinkedinUrl } from "./dedupe";

export type OptOutKey = { kind: "EMAIL" | "LINKEDIN" | "PROVIDER_ID" | "PERSON"; valueHash: string };

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/** Hash of a person key ("marie|d|acme"): stored as the suggestion's dedupe key and in the opt-out list. */
export function personHash(personKey: string) {
  return sha256(`person:${personKey}`);
}

export function optOutKeys(input: {
  email?: string | null;
  linkedinUrl?: string | null;
  provider?: string | null;
  externalId?: string | null;
  /** Already hashed with personHash. */
  personHash?: string | null;
}): OptOutKey[] {
  const keys: OptOutKey[] = [];
  const email = input.email?.trim().toLowerCase();
  if (email) keys.push({ kind: "EMAIL", valueHash: sha256(email) });
  const linkedin = normalizeLinkedinUrl(input.linkedinUrl);
  if (linkedin) keys.push({ kind: "LINKEDIN", valueHash: sha256(linkedin) });
  if (input.provider && input.externalId) {
    keys.push({ kind: "PROVIDER_ID", valueHash: sha256(`${input.provider.toLowerCase()}:${input.externalId}`) });
  }
  if (input.personHash) keys.push({ kind: "PERSON", valueHash: input.personHash });
  return keys;
}
