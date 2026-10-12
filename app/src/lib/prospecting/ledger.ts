import type { CreditEntryKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import type { ProviderName } from "./providers/types";

/** Append-only. DELIVERED rows are the future billing unit (one ready contact). */
export function recordCredits(entry: {
  organizationId: string;
  provider: ProviderName;
  kind: CreditEntryKind;
  credits: number;
  estimated: boolean;
  suggestionId?: string | null;
}) {
  return prisma.prospectingCreditEntry.create({ data: entry });
}

export function startOfUtcDay(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}
