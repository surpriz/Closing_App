import type { ProspectingProvider } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { maskLastName, personKey, splitFullName } from "./dedupe";
import { recordCredits } from "./ledger";
import { optedOut } from "./opt-out";
import { regionOfDepartement } from "./geo";
import { personHash } from "./opt-out-hash";
import { getProvider } from "./providers";
import { ProviderError, type Candidate } from "./providers/types";
import { lookupCompanyName } from "./sirene/lookup";
import { companyFit, seniorityFromTitle, type TargetFilters } from "./target";
import { filtersOf } from "./targets";

const WANTED = 25; // new suggestions per run: enough to sort through, not a flood
const TIME_BUDGET_MS = 50_000;
// A run still RUNNING after this was killed with its function (timeout, deploy)
const RUN_STALE_MS = 5 * 60 * 1000;
// Below this the registry pick is a guess (namesakes): never a reason to drop someone
const SURE_MATCH = 0.8;

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
  const regions = [...new Set([...filters.regions, ...filters.departements.map(regionOfDepartement)])].filter(
    (code): code is string => !!code,
  );
  const record = await lookupCompanyName(companyName, { regions }, now).catch(() => null);
  if (!record?.siren || record.confidence < SURE_MATCH) return { verdict: "unknown", siren: null };
  return { verdict: companyFit(record, filters), siren: record.siren };
}

/** One search, run in the background. Never throws: the run says DONE or FAILED. */
export async function runSearch(runId: string, now = new Date()) {
  const run = await prisma.prospectingRun.findUnique({ where: { id: runId }, include: { targetProfile: true } });
  if (!run || run.status !== "RUNNING") return;

  const counts = { found: 0, skipped: 0, created: 0 };
  let note: string | null = null;
  try {
    const provider = getProvider(run.organizationId, run.provider);
    if (!provider) throw new Error(`${run.provider} n'est pas configuré`);

    const filters = filtersOf(run.targetProfile);
    const known = await knownToWorkspace(run.organizationId, filters);
    const companies = new Map<string, CompanyCheck>();
    const started = Date.now();

    for (let page = 1; page <= provider.maxPages && counts.created < WANTED; page++) {
      if (Date.now() - started > TIME_BUDGET_MS) break;
      let result;
      try {
        result = await provider.searchPeople(filters, page);
      } catch (error) {
        // A plan limit on a later page (Lemlist's trial reads one page): keep what was found
        if (page === 1 || !(error instanceof ProviderError)) throw error;
        note = `Arrêtée page ${page} : ${error.message.slice(0, 200)}`;
        break;
      }
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
        // A company the seller already works with
        if (fit.siren && known.excludedSirens.has(fit.siren)) continue;
        // Another sector in the registry. When the seller described the sector in their own words
        // the provider matched those words: NAF codes split one trade (web agencies sit in 62 and
        // 73), so the contact is kept and flagged rather than dropped
        if (fit.verdict === "off_target" && filters.keywords.length === 0) continue;

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
            // true: the registry agrees; false: another NAF code; null: the registry could not tell
            nafVerified: fit.verdict === "unknown" ? null : fit.verdict === "match",
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
      data: { status: "DONE", finishedAt: new Date(), error: note, ...counts },
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
