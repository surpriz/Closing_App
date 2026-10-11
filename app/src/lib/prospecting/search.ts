import type { ProspectingProvider } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { maskLastName, personKey, splitFullName } from "./dedupe";
import { recordCredits } from "./ledger";
import { optedOut } from "./opt-out";
import { personHash } from "./opt-out-hash";
import { getProvider } from "./providers";
import type { Candidate } from "./providers/types";
import { lookupCompanyName } from "./sirene/lookup";
import { companyFit, seniorityFromTitle, type TargetFilters } from "./target";
import { filtersOf } from "./targets";

const MAX_PAGES = 4;
const WANTED = 25; // new suggestions per run: enough to sort through, not a flood
const TIME_BUDGET_MS = 50_000;
// A run still RUNNING after this was killed with its function (timeout, deploy)
const RUN_STALE_MS = 5 * 60 * 1000;

type CompanyCheck = { verdict: "match" | "off_target" | "unknown"; siren: string | null };

function candidateHash(candidate: Candidate, provider: string) {
  const key = personKey(candidate);
  return personHash(key ?? `${provider}:${candidate.externalId}`);
}

/** People and companies already known to the workspace: never suggested (again). */
async function knownToWorkspace(organizationId: string, filters: TargetFilters) {
  const [suggestions, prospects, customers] = await Promise.all([
    prisma.prospectSuggestion.findMany({
      where: { organizationId },
      select: { provider: true, externalId: true, dedupeKey: true },
    }),
    prisma.prospect.findMany({
      where: { link: { organizationId } },
      select: { name: true, company: true },
    }),
    // Customers' companies, from the registry cache filled by the target deduction
    prisma.companyLookup.findMany({
      where: { key: { in: filters.excludedDomains.map((domain) => `domain:${domain}`) }, siren: { not: null } },
      select: { siren: true },
    }),
  ]);
  const prospectHashes = prospects.flatMap((p) => {
    const { first, last } = splitFullName(p.name);
    const key = personKey({ firstName: first, lastName: last, companyName: p.company });
    return key ? [personHash(key)] : [];
  });
  return {
    ids: new Set(suggestions.map((s) => `${s.provider}:${s.externalId}`)),
    people: new Set([...suggestions.map((s) => s.dedupeKey), ...prospectHashes]),
    excludedSirens: new Set(customers.map((c) => c.siren!)),
  };
}

async function companyCheck(companyName: string, filters: TargetFilters, now: Date): Promise<CompanyCheck> {
  const record = await lookupCompanyName(companyName, null, now).catch(() => null);
  return { verdict: companyFit(record?.siren ? record : null, filters), siren: record?.siren ?? null };
}

/** One search, run in the background. Never throws: the run says DONE or FAILED. */
export async function runSearch(runId: string, now = new Date()) {
  const run = await prisma.prospectingRun.findUnique({ where: { id: runId }, include: { targetProfile: true } });
  if (!run || run.status !== "RUNNING") return;

  const counts = { found: 0, skipped: 0, created: 0 };
  try {
    const provider = getProvider(run.organizationId, run.provider);
    if (!provider) throw new Error(`${run.provider} n'est pas configuré`);

    const filters = filtersOf(run.targetProfile);
    const known = await knownToWorkspace(run.organizationId, filters);
    const companies = new Map<string, CompanyCheck>();
    const started = Date.now();

    for (let page = 1; page <= MAX_PAGES && counts.created < WANTED; page++) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      const result = await provider.searchPeople(filters, page);
      await recordCredits({
        organizationId: run.organizationId,
        provider: run.provider,
        kind: "SEARCH",
        credits: result.credits,
        estimated: result.estimated,
      });
      counts.found += result.candidates.length;

      const fresh = result.candidates.filter((candidate) => {
        const duplicate =
          known.ids.has(`${run.provider}:${candidate.externalId}`) ||
          known.people.has(candidateHash(candidate, run.provider));
        const excluded = !!candidate.companyDomain && filters.excludedDomains.includes(candidate.companyDomain);
        return !duplicate && !excluded;
      });
      const blocked = await optedOut(
        fresh.map((c) => ({
          linkedinUrl: c.linkedinUrl,
          provider: run.provider,
          externalId: c.externalId,
          personHash: candidateHash(c, run.provider),
        })),
      );

      for (const [index, candidate] of fresh.entries()) {
        if (counts.created >= WANTED) break;
        if (blocked.has(index)) continue;

        const companyName = candidate.companyName;
        if (companyName && !companies.has(companyName)) {
          companies.set(companyName, await companyCheck(companyName, filters, now));
        }
        const fit = (companyName && companies.get(companyName)) || { verdict: "unknown", siren: null };
        // Off target, or a company the seller already works with
        if (fit.verdict === "off_target" || (fit.siren && known.excludedSirens.has(fit.siren))) continue;

        const dedupeKey = candidateHash(candidate, run.provider);
        known.ids.add(`${run.provider}:${candidate.externalId}`);
        known.people.add(dedupeKey);
        await prisma.prospectSuggestion.create({
          data: {
            organizationId: run.organizationId,
            runId: run.id,
            provider: run.provider,
            externalId: candidate.externalId,
            sourceFetchedAt: now,
            firstName: candidate.firstName,
            lastNameMasked: candidate.lastNameIsMasked ? candidate.lastName : maskLastName(candidate.lastName),
            // Lemlist gives the full name before any reveal: kept for later, never shown before
            lastName: candidate.lastNameIsMasked ? null : candidate.lastName,
            title: candidate.title,
            seniority: seniorityFromTitle(candidate.title),
            companyName,
            companyDomain: candidate.companyDomain,
            companySiren: fit.siren,
            // null: the registry could not tell, which is not the same as another sector
            nafVerified: fit.verdict === "match" ? true : null,
            linkedinUrl: candidate.linkedinUrl,
            dedupeKey,
          },
        });
        counts.created++;
      }
      counts.skipped = counts.found - counts.created;
      if (!result.hasMore) break;
    }

    await prisma.prospectingRun.update({
      where: { id: run.id },
      data: { status: "DONE", finishedAt: new Date(), ...counts },
    });
  } catch (error) {
    console.error("[prospecting:search]", error);
    await prisma.prospectingRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        finishedAt: new Date(),
        error: error instanceof Error ? error.message.slice(0, 300) : "Erreur inconnue",
        ...counts,
      },
    });
  }
}

/** Runs whose function died before finishing: failed, so they no longer block new searches. */
export function expireStaleRuns(now: Date, scope: { organizationId?: string } = {}) {
  return prisma.prospectingRun.updateMany({
    where: { ...scope, status: "RUNNING", startedAt: { lt: new Date(now.getTime() - RUN_STALE_MS) } },
    data: { status: "FAILED", finishedAt: now, error: "Recherche interrompue" },
  });
}

export async function startRun(input: {
  organizationId: string;
  targetProfileId: string;
  provider: ProspectingProvider;
  comparisonId?: string | null;
}) {
  const target = await prisma.targetProfile.findUniqueOrThrow({ where: { id: input.targetProfileId } });
  return prisma.prospectingRun.create({
    data: {
      organizationId: input.organizationId,
      targetProfileId: input.targetProfileId,
      provider: input.provider,
      comparisonId: input.comparisonId ?? null,
      filtersSnapshot: filtersOf(target),
    },
  });
}
