// Which customer may be named as a reference in a first message. Pure.
import { nafDivision } from "./naf";

export type ReferenceCandidate = {
  company: string;
  naf: string | null;
  /** Null: the customer never agreed to be named. Such a candidate is never picked. */
  consentAt: Date | null;
};

/** A consenting customer, from the prospect's sector when there is one. */
export function pickReference(candidates: ReferenceCandidate[], prospectNaf: string | null) {
  const consenting = candidates.filter((c) => c.consentAt && c.company.trim());
  if (consenting.length === 0) return null;
  const sameSector = prospectNaf
    ? consenting.find((c) => c.naf && nafDivision(c.naf) === nafDivision(prospectNaf))
    : undefined;
  return (sameSector ?? consenting[0]).company.trim();
}
