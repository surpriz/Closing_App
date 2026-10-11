import type { ProspectSuggestion } from "@/generated/prisma/client";
import type { SuggestionInvalidReason } from "@/generated/prisma/enums";
import { isPersonalEmail } from "@/lib/closing/prospects/from-recipient";
import { prisma } from "@/lib/db";

import { recordCredits } from "./ledger";
import { optedOut } from "./opt-out";
import { getProvider } from "./providers";
import type { RevealDone, RevealInput, RevealOutcome } from "./providers/types";

const POLL_BATCH = 20;
const POLL_SPACING_MS = 5_000; // Lemlist results take a few seconds; no need to ask more often
const RESTART_AFTER_MS = 60_000; // a start that failed or died before reaching the provider
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

function identity(suggestion: ProspectSuggestion, extra: { email?: string | null; linkedinUrl?: string | null } = {}) {
  return {
    email: extra.email,
    linkedinUrl: extra.linkedinUrl ?? suggestion.linkedinUrl,
    provider: suggestion.provider,
    externalId: suggestion.externalId,
    personHash: suggestion.dedupeKey,
  };
}

/** Why a revealed address cannot be handed over, if it cannot. */
async function rejection(suggestion: ProspectSuggestion, outcome: RevealDone): Promise<SuggestionInvalidReason | null> {
  if (!outcome.email) return "NOT_FOUND";
  if (isPersonalEmail(outcome.email)) return "PERSONAL";
  if (!outcome.verified) return "UNVERIFIED";

  // The opt-out may have come from another workspace after this person was suggested here
  const blocked = await optedOut([identity(suggestion, outcome)]);
  if (blocked.size > 0) return "OPTED_OUT";

  const sameEmail = { equals: outcome.email, mode: "insensitive" as const };
  const [prospect, suggested] = await Promise.all([
    prisma.prospect.findFirst({
      where: { email: sameEmail, link: { organizationId: suggestion.organizationId } },
      select: { id: true },
    }),
    // The same person found by the other provider and already revealed
    prisma.prospectSuggestion.findFirst({
      where: { organizationId: suggestion.organizationId, email: sameEmail, id: { not: suggestion.id } },
      select: { id: true },
    }),
  ]);
  return prospect || suggested ? "DUPLICATE" : null;
}

async function finish(suggestion: ProspectSuggestion, outcome: RevealDone, now: Date) {
  const reason = await rejection(suggestion, outcome);

  // Claimed once: never two ledger entries for one reveal
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
  const base = { organizationId: suggestion.organizationId, provider: suggestion.provider, suggestionId: suggestion.id };
  // Spent even if the seller opted the person out meanwhile: the ledger must match the provider's bill
  if (outcome.credits > 0) {
    const already = await prisma.prospectingCreditEntry.count({ where: { suggestionId: suggestion.id, kind: "REVEAL" } });
    if (already === 0) {
      await recordCredits({ ...base, kind: "REVEAL", credits: outcome.credits, estimated: outcome.estimated });
    }
  }
  if (claimed.count === 1 && !reason) await recordCredits({ ...base, kind: "DELIVERED", credits: 1, estimated: false });
}

async function apply(suggestion: ProspectSuggestion, outcome: RevealOutcome, now: Date) {
  try {
    if (outcome.state === "done") await finish(suggestion, outcome, now);
    else if (outcome.state === "pending") {
      await prisma.prospectSuggestion.update({ where: { id: suggestion.id }, data: { revealJobId: outcome.jobId } });
    } else console.error(`[prospecting:reveal] ${suggestion.provider}`, outcome.message);
  } catch (error) {
    console.error("[prospecting:reveal]", error);
  }
}

/**
 * Asks the providers for the emails of accepted suggestions. Each row is claimed first: a
 * background start, a page poll and the cron may all try at once, a provider call is paid.
 */
export async function startReveals(suggestionIds: string[], now = new Date()) {
  const candidates = await prisma.prospectSuggestion.findMany({
    where: { id: { in: suggestionIds }, status: "REVEALING", revealJobId: null, revealAttempts: { lt: MAX_STARTS } },
  });

  const claimed: ProspectSuggestion[] = [];
  for (const suggestion of candidates) {
    const { count } = await prisma.prospectSuggestion.updateMany({
      where: { id: suggestion.id, status: "REVEALING", revealJobId: null, revealAttempts: suggestion.revealAttempts },
      data: { revealAttempts: { increment: 1 }, updatedAt: now },
    });
    if (count === 1) claimed.push(suggestion);
  }

  // Opted out since the search (maybe from another workspace): no credit spent on them
  const blocked = await optedOut(claimed.map((s) => identity(s)));
  const optedOutIds = claimed.filter((_, index) => blocked.has(index)).map((s) => s.id);
  if (optedOutIds.length) {
    await prisma.prospectSuggestion.updateMany({
      where: { id: { in: optedOutIds }, status: "REVEALING" },
      data: { status: "INVALID", invalidReason: "OPTED_OUT", revealedAt: now },
    });
  }

  const byProvider = Map.groupBy(
    claimed.filter((_, index) => !blocked.has(index)),
    (s) => `${s.organizationId}:${s.provider}`,
  );
  for (const group of byProvider.values()) {
    const provider = getProvider(group[0].organizationId, group[0].provider);
    if (!provider) continue;
    const outcomes = await provider.startReveal(group.map(revealInput));
    for (const outcome of outcomes) {
      const suggestion = group.find((s) => s.externalId === outcome.externalId);
      if (suggestion) await apply(suggestion, outcome, now);
    }
  }
}

/**
 * Follows reveals in flight: polls async jobs, restarts starts that failed, and gives up after
 * 30 minutes (asking an async job one last time, so a late result is still counted).
 */
export async function pollPendingReveals(now = new Date(), scope: { organizationId?: string } = {}) {
  const expiry = new Date(now.getTime() - EXPIRE_AFTER_MS);
  await prisma.prospectSuggestion.updateMany({
    where: {
      ...scope,
      status: "REVEALING",
      revealJobId: null,
      revealStartedAt: { lt: expiry },
    },
    data: { status: "INVALID", invalidReason: "NOT_FOUND" },
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
    // Claimed by its updatedAt: one poll per job at a time
    const { count } = await prisma.prospectSuggestion.updateMany({
      where: { id: suggestion.id, updatedAt: suggestion.updatedAt },
      data: { updatedAt: now },
    });
    const provider = getProvider(suggestion.organizationId, suggestion.provider);
    if (count === 0 || !provider || !suggestion.revealJobId) continue;

    try {
      const outcome = await provider.pollReveal(suggestion.revealJobId, revealInput(suggestion));
      if (outcome.state === "done") await finish(suggestion, outcome, now);
      else if (suggestion.revealStartedAt && suggestion.revealStartedAt < expiry) {
        // Lemlist only bills an email it found: nothing to record for a job that never ends
        await prisma.prospectSuggestion.updateMany({
          where: { id: suggestion.id, status: "REVEALING" },
          data: { status: "INVALID", invalidReason: "NOT_FOUND", revealJobId: null },
        });
      }
    } catch (error) {
      console.error(`[prospecting:poll] ${suggestion.provider}`, error);
    }
  }
}
