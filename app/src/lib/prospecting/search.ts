import type { ProspectingProvider } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";

import { maskLastName, personKey, splitFullName } from "./dedupe";
import { recordCredits } from "./ledger";
import { optedOut } from "./opt-out";
import { getProvider } from "./providers";
import type { Candidate } from "./providers/types";
import { lookupCompanyName } from "./sirene/lookup";
import { companyFit, seniorityFromTitle } from "./target";
import { filtersOf } from "./targets";

const MAX_PAGES = 4;
const WANTED = 25; // new suggestions per run: enough to sort through, not a flood
const TIME_BUDGET_MS = 50_000;

/** People already known to the workspace, whatever their status: never suggested (again). */
async function knownPeople(organizationId: string) {
  const [suggestions, prospects] = await Promise.all([
    prisma.prospectSuggestion.findMany({
      where: { organizationId },
      select: { provider: true, externalId: true, dedupeKey: true },
    }),
    prisma.prospect.findMany({
      where: { link: { organizationId } },
      select: { name: true, company: true },
    }),
  ]);
  const prospectKeys = prospects.map((p) => {
    const { first, last } = splitFullName(p.name);
    return personKey({ firstName: first, lastName: last, companyName: p.company });
  });
  return {
    ids: new Set(suggestions.map((s) => `${s.provider}:${s.externalId}`)),
    keys: new Set([...suggestions.map((s) => s.dedupeKey), ...prospectKeys].filter(Boolean)),
  };
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
    const known = await knownPeople(run.organizationId);
    const fits = new Map<string, Awaited<ReturnType<typeof companyCheck>>>();
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
        const key = dedupeKeyOf(candidate);
        const duplicate = known.ids.has(`${run.provider}:${candidate.externalId}`) || (key && known.keys.has(key));
        const excluded = !!candidate.companyDomain && filters.excludedDomains.includes(candidate.companyDomain);
        return !duplicate && !excluded;
      });
      const blocked = await optedOut(
        fresh.map((c) => ({ linkedinUrl: c.linkedinUrl, provider: run.provider, externalId: c.externalId })),
      );

      for (const [index, candidate] of fresh.entries()) {
        if (counts.created >= WANTED) break;
        if (blocked.has(index)) continue;

        const companyName = candidate.companyName;
        if (companyName && !fits.has(companyName)) fits.set(companyName, await companyCheck(companyName, filters, now));
        const fit = companyName ? fits.get(companyName)! : { verdict: "unknown" as const, siren: null };
        if (fit.verdict === "off_target") continue;

        const key = dedupeKeyOf(candidate) ?? `${run.provider}:${candidate.externalId}`;
        known.ids.add(`${run.provider}:${candidate.externalId}`);
        known.keys.add(key);
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
            nafVerified: fit.verdict === "match" ? true : false,
            linkedinUrl: candidate.linkedinUrl,
            dedupeKey: key,
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

function dedupeKeyOf(candidate: Candidate) {
  return personKey({ firstName: candidate.firstName, lastName: candidate.lastName, companyName: candidate.companyName });
}

async function companyCheck(companyName: string, filters: ReturnType<typeof filtersOf>, now: Date) {
  const record = await lookupCompanyName(companyName, null, now).catch(() => null);
  return { verdict: companyFit(record?.siren ? record : null, filters), siren: record?.siren ?? null };
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
