import type { ProspectSuggestion } from "@/generated/prisma/client";
import type { SuggestionInvalidReason } from "@/generated/prisma/enums";
import { isPersonalEmail } from "@/lib/closing/prospects/from-recipient";
import { prisma } from "@/lib/db";

import { recordCredits } from "./ledger";
import { optedOut } from "./opt-out";
import { getProvider } from "./providers";
import type { RevealDone, RevealInput } from "./providers/types";

const POLL_BATCH = 20;
const POLL_SPACING_MS = 5_000; // Lemlist results take a few seconds; no need to ask more often
const RESTART_AFTER_MS = 60_000; // a background start that died before reaching the provider
const MAX_STARTS = 3;
const EXPIRE_AFTER_MS = 30 * 60 * 1000;

function revealInput(suggestion: ProspectSuggestion): RevealInput {
  return {
    externalId: suggestion.externalId,
    firstName: suggestion.firstName,
    lastName: suggestion.lastName,
    companyName: suggestion.companyName,
    companyDomain: suggestion.companyDomain,
    linkedinUrl: suggestion.linkedinUrl,
  };
}

/** Why a revealed address cannot be handed over, if it cannot. */
async function rejection(suggestion: ProspectSuggestion, outcome: RevealDone): Promise<SuggestionInvalidReason | null> {
  if (!outcome.email) return "NOT_FOUND";
  if (isPersonalEmail(outcome.email)) return "PERSONAL";
  if (!outcome.verified) return "UNVERIFIED";

  const blocked = await optedOut([{ email: outcome.email, linkedinUrl: outcome.linkedinUrl ?? suggestion.linkedinUrl }]);
  if (blocked.size > 0) return "OPTED_OUT";

  const known = await prisma.prospect.findFirst({
    where: { email: { equals: outcome.email, mode: "insensitive" }, link: { organizationId: suggestion.organizationId } },
    select: { id: true },
  });
  return known ? "DUPLICATE" : null;
}

async function finish(suggestion: ProspectSuggestion, outcome: RevealDone, now: Date) {
  const reason = await rejection(suggestion, outcome);

  // Claimed once: a background start and a poll may land together
  const claimed = await prisma.prospectSuggestion.updateMany({
    where: { id: suggestion.id, status: "REVEALING" },
    data: reason
      ? { status: "INVALID", invalidReason: reason, emailStatus: outcome.emailStatus, revealedAt: now, revealJobId: null }
      : {
          status: "READY",
          email: outcome.email,
          emailStatus: outcome.emailStatus,
          lastName: outcome.lastName ?? suggestion.lastName,
          linkedinUrl: outcome.linkedinUrl ?? suggestion.linkedinUrl,
          companyDomain: outcome.companyDomain ?? suggestion.companyDomain,
          revealedAt: now,
          revealJobId: null,
        },
  });
  if (claimed.count === 0) return;

  const base = { organizationId: suggestion.organizationId, provider: suggestion.provider, suggestionId: suggestion.id };
  if (outcome.credits > 0) {
    await recordCredits({ ...base, kind: "REVEAL", credits: outcome.credits, estimated: outcome.estimated });
  }
  if (!reason) await recordCredits({ ...base, kind: "DELIVERED", credits: 1, estimated: false });
}

/** Asks the providers for the emails of accepted suggestions. Errors are retried by the poll. */
export async function startReveals(suggestionIds: string[], now = new Date()) {
  const suggestions = await prisma.prospectSuggestion.findMany({
    where: { id: { in: suggestionIds }, status: "REVEALING", revealJobId: null },
  });

  const byProvider = Map.groupBy(suggestions, (s) => `${s.organizationId}:${s.provider}`);
  for (const group of byProvider.values()) {
    const { organizationId, provider: name } = group[0];
    await prisma.prospectSuggestion.updateMany({
      where: { id: { in: group.map((s) => s.id) } },
      data: { revealAttempts: { increment: 1 } },
    });

    const provider = getProvider(organizationId, name);
    if (!provider) continue;
    try {
      const outcomes = await provider.startReveal(group.map(revealInput));
      for (const outcome of outcomes) {
        const suggestion = group.find((s) => s.externalId === outcome.externalId);
        if (!suggestion) continue;
        if (outcome.state === "done") await finish(suggestion, outcome, now);
        else await prisma.prospectSuggestion.update({ where: { id: suggestion.id }, data: { revealJobId: outcome.jobId } });
      }
    } catch (error) {
      console.error(`[prospecting:reveal] ${name}`, error);
    }
  }
}

/**
 * Follows reveals in flight: polls async jobs, restarts starts that never reached the provider,
 * gives up after 30 minutes (nothing is billed for those).
 */
export async function pollPendingReveals(now = new Date(), scope: { organizationId?: string } = {}) {
  await prisma.prospectSuggestion.updateMany({
    where: { ...scope, status: "REVEALING", revealStartedAt: { lt: new Date(now.getTime() - EXPIRE_AFTER_MS) } },
    data: { status: "INVALID", invalidReason: "NOT_FOUND", revealJobId: null },
  });

  const stalled = await prisma.prospectSuggestion.findMany({
    where: {
      ...scope,
      status: "REVEALING",
      revealJobId: null,
      revealAttempts: { lt: MAX_STARTS },
      updatedAt: { lt: new Date(now.getTime() - RESTART_AFTER_MS) },
    },
    select: { id: true },
    take: POLL_BATCH,
  });
  if (stalled.length) await startReveals(stalled.map((s) => s.id), now);

  const pending = await prisma.prospectSuggestion.findMany({
    where: {
      ...scope,
      status: "REVEALING",
      revealJobId: { not: null },
      updatedAt: { lt: new Date(now.getTime() - POLL_SPACING_MS) },
    },
    orderBy: { updatedAt: "asc" },
    take: POLL_BATCH,
  });

  for (const suggestion of pending) {
    const provider = getProvider(suggestion.organizationId, suggestion.provider);
    if (!provider || !suggestion.revealJobId) continue;
    try {
      const outcome = await provider.pollReveal(suggestion.revealJobId, revealInput(suggestion));
      if (outcome.state === "done") await finish(suggestion, outcome, now);
      else await prisma.prospectSuggestion.update({ where: { id: suggestion.id }, data: { updatedAt: now } });
    } catch (error) {
      console.error(`[prospecting:poll] ${suggestion.provider}`, error);
      await prisma.prospectSuggestion.update({ where: { id: suggestion.id }, data: { updatedAt: now } });
    }
  }
}
