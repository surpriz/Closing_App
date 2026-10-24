"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { getPublicAppUrl } from "@/lib/app-origin";
import { PlanLimitError, upgradePrompt } from "@/lib/billing/workspace-plan";
import { inBackground } from "@/lib/closing/background";
import { confirmLinkSent, createDocumentLink } from "@/lib/closing/documents/create-link";
import { shareLink } from "@/lib/closing/link-url";
import { unsubscribePageUrl } from "@/lib/closing/unsubscribe";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { availableProviders } from "@/lib/prospecting/credentials";
import { requireProspecting } from "@/lib/prospecting/flag";
import { draftOutreach } from "@/lib/prospecting/hook";
import { outreachFooter } from "@/lib/prospecting/hook-prompt";
import { inferWorkspaceTarget } from "@/lib/prospecting/infer/collect";
import { startOfUtcDay } from "@/lib/prospecting/ledger";
import { addOptOut, optedOut } from "@/lib/prospecting/opt-out";
import { revealAllowance } from "@/lib/prospecting/quota";
import { startReveals } from "@/lib/prospecting/reveal";
import { expireStaleRuns, runSearch, startRun } from "@/lib/prospecting/search";
import { splitList, targetFiltersSchema, targetIsSearchable, type TargetFilters } from "@/lib/prospecting/target";
import { activeTarget, filtersOf, saveTarget } from "@/lib/prospecting/targets";
import { PERSONAL_FIELDS } from "@/lib/prospecting/tick";

export type ActionResult = { ok: true; notice?: string } | { error: string };

export type DeducedTarget =
  | { filters: TargetFilters; evidence: { domains: number; recognized: number; won: number; averageConfidence: number | null } }
  | { error: string };

const evidenceSchema = z
  .object({
    domains: z.number(),
    recognized: z.number(),
    won: z.number(),
    averageConfidence: z.number().nullable(),
  })
  .nullable();

export async function saveTargetAction(formData: FormData): Promise<ActionResult> {
  const { user, organization } = await requireProspecting();

  const parsed = targetFiltersSchema.safeParse({
    nafCodes: splitList(formData.get("nafCodes")?.toString()),
    keywords: splitList(formData.get("keywords")?.toString()),
    headcountCodes: formData.getAll("headcountCodes").map(String),
    regions: formData.getAll("regions").map(String),
    departements: splitList(formData.get("departements")?.toString()),
    jobTitles: splitList(formData.get("jobTitles")?.toString()),
    seniorities: formData.getAll("seniorities").map(String),
    excludedDomains: splitList(formData.get("excludedDomains")?.toString()),
  });
  if (!parsed.success) return { error: (await getTranslations("prospecting.actions"))("fieldTooLong") };

  const inferred = formData.get("origin") === "INFERRED";
  let evidence: z.infer<typeof evidenceSchema> = null;
  if (inferred) {
    try {
      evidence = evidenceSchema.parse(JSON.parse(formData.get("evidence")?.toString() || "null"));
    } catch {
      evidence = null;
    }
  }

  await saveTarget({
    organizationId: organization.id,
    userId: user.id,
    filters: parsed.data,
    origin: inferred ? "INFERRED" : "MANUAL",
    evidence,
  });
  revalidatePath("/prospecting");
  return { ok: true };
}

/** Proposed target from the seller's deals; nothing is saved until the seller checks it. */
export async function deduceTargetAction(): Promise<DeducedTarget> {
  const { organization } = await requireProspecting();
  const inferred = await inferWorkspaceTarget(organization.id);

  if (inferred.evidence.recognized === 0) {
    const t = await getTranslations("prospecting.actions");
    return {
      error: inferred.evidence.domains ? t("noCompanyRecognized") : t("noProfessionalSends"),
    };
  }

  return {
    filters: {
      nafCodes: inferred.nafCodes,
      keywords: [],
      headcountCodes: inferred.headcountCodes,
      regions: inferred.regions,
      departements: inferred.departements,
      jobTitles: [],
      seniorities: ["owner", "founder", "c_suite", "director"],
      excludedDomains: inferred.customerDomains.slice(0, 50),
    },
    evidence: inferred.evidence,
  };
}

const providerSchema = z.enum(["APOLLO", "LEMLIST", "MOCK"]);

/**
 * Starts a search on the active target; the page follows the run until it is done. Several
 * providers at once share a comparisonId and run one after the other on the same target.
 */
export async function startSearchAction(providers: string[]): Promise<ActionResult> {
  const { organization } = await requireProspecting();
  const t = await getTranslations("prospecting.actions");
  const names = z.array(providerSchema).min(1).max(3).parse(providers);
  const available = availableProviders(organization.id);
  if (names.some((name) => !available.includes(name))) return { error: t("providerNotConfigured") };

  const target = await activeTarget(organization.id);
  if (!target || !targetIsSearchable(filtersOf(target))) {
    return { error: t("targetNotSearchable") };
  }
  const now = new Date();
  await expireStaleRuns(now, { organizationId: organization.id });
  const running = await prisma.prospectingRun.count({
    where: { organizationId: organization.id, status: "RUNNING" },
  });
  if (running > 0) return { error: t("searchRunning") };

  const comparisonId = names.length > 1 ? crypto.randomUUID() : null;
  const runIds: string[] = [];
  for (const provider of names) {
    const run = await startRun({ organizationId: organization.id, targetProfileId: target.id, provider, comparisonId });
    runIds.push(run.id);
  }
  inBackground("prospecting-search", async () => {
    for (const runId of runIds) await runSearch(runId);
  });
  revalidatePath("/prospecting");
  return { ok: true };
}

async function ownedSuggestion(organizationId: string, suggestionId: string) {
  const suggestion = await prisma.prospectSuggestion.findFirst({ where: { id: suggestionId, organizationId } });
  if (!suggestion) throw new Error("Suggestion introuvable");
  return suggestion;
}

/** Not for this seller: never suggested again in this workspace. */
export async function rejectSuggestionAction(suggestionId: string): Promise<ActionResult> {
  const { user, organization } = await requireProspecting();
  const { count } = await prisma.prospectSuggestion.updateMany({
    where: { id: suggestionId, organizationId: organization.id, status: "SUGGESTED" },
    data: { status: "REJECTED", decidedAt: new Date(), decidedById: user.id },
  });
  if (count === 0) return { error: (await getTranslations("prospecting.actions"))("alreadyHandled") };
  revalidatePath("/prospecting");
  return { ok: true };
}

/**
 * The person asked not to be contacted: never suggested again, to anyone, and the workspace's
 * prospect rows with that address stop receiving anything.
 */
export async function optOutSuggestionAction(suggestionId: string): Promise<ActionResult> {
  const { user, organization } = await requireProspecting();
  const suggestion = await ownedSuggestion(organization.id, suggestionId);
  if (suggestion.status === "REVEALING") return { error: (await getTranslations("prospecting.actions"))("waitReveal") };

  await addOptOut(
    {
      email: suggestion.email,
      linkedinUrl: suggestion.linkedinUrl,
      provider: suggestion.provider,
      externalId: suggestion.externalId,
      personHash: suggestion.dedupeKey,
    },
    "seller",
  );
  if (suggestion.email) {
    await prisma.prospect.updateMany({
      where: {
        email: { equals: suggestion.email, mode: "insensitive" },
        link: { organizationId: organization.id },
        unsubscribedAt: null,
      },
      data: { unsubscribedAt: new Date() },
    });
  }
  await prisma.prospectSuggestion.update({
    where: { id: suggestion.id },
    // Nothing that identifies someone who said no
    data: { status: "REJECTED", decidedAt: new Date(), decidedById: user.id, ...PERSONAL_FIELDS },
  });
  revalidatePath("/prospecting");
  return { ok: true };
}

/** Accepted contacts are revealed (provider credits) in the background, within the daily cap. */
export async function acceptSuggestionsAction(suggestionIds: string[]): Promise<ActionResult> {
  const { user, organization } = await requireProspecting();
  const t = await getTranslations("prospecting.actions");
  const ids = z.array(z.string().min(1)).min(1).max(50).parse(suggestionIds);
  const now = new Date();
  const dailyLimit = getEnv().PROSPECTING_DAILY_REVEAL_LIMIT;

  // Serializable: two accepts at once must not both fit under the daily cap
  let outcome: { accepted: string[]; asked: number };
  try {
    outcome = await prisma.$transaction(
      async (tx) => {
        const open = await tx.prospectSuggestion.findMany({
          where: { id: { in: ids }, organizationId: organization.id, status: "SUGGESTED" },
          orderBy: { createdAt: "asc" },
          select: { id: true },
        });
        const revealsToday = await tx.prospectSuggestion.count({
          where: { organizationId: organization.id, revealStartedAt: { gte: startOfUtcDay(now) } },
        });
        const accepted = open.slice(0, revealAllowance({ revealsToday, requested: open.length, dailyLimit })).map((s) => s.id);
        await tx.prospectSuggestion.updateMany({
          where: { id: { in: accepted }, status: "SUGGESTED" },
          data: { status: "REVEALING", decidedAt: now, decidedById: user.id, revealStartedAt: now },
        });
        return { accepted, asked: open.length };
      },
      { isolationLevel: "Serializable" },
    );
  } catch {
    return { error: t("concurrentChoice") };
  }

  if (outcome.asked === 0) return { error: t("allAlreadyHandled") };
  if (outcome.accepted.length === 0) return { error: t("dailyLimitReached") };

  inBackground("prospecting-reveal", () => startReveals(outcome.accepted, now));
  revalidatePath("/prospecting");
  const left = outcome.asked - outcome.accepted.length;
  return left > 0
    ? { ok: true, notice: t("dailyLimitPartial", { left }) }
    : { ok: true };
}

export type OutreachResult =
  | { linkId: string; url: string; title: string; email: string; subject: string; body: string; draft: boolean }
  | { error: string };

// Placeholder linkId while the link is being created; reclaimed if the request died
const CREATING = "creating";
const CREATING_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * A tracked link for a ready contact, with a first message the seller sends from their own
 * mailbox. The link stays a draft until the seller says it was sent (or the contact opens it),
 * and Clozer never sends follow-ups on its own to someone who never asked to hear from us.
 */
export async function createOutreachLinkAction(suggestionId: string, documentId: string): Promise<OutreachResult> {
  const { user, organization } = await requireProspecting();
  const t = await getTranslations("prospecting.actions");
  const suggestion = await ownedSuggestion(organization.id, suggestionId);
  if (suggestion.status !== "READY" || !suggestion.email) return { error: t("contactNotReady") };

  // The person may have opted out, here or elsewhere, since the reveal
  const [blocked, unsubscribed] = await Promise.all([
    optedOut([{ email: suggestion.email, linkedinUrl: suggestion.linkedinUrl, personHash: suggestion.dedupeKey }]),
    prisma.prospect.findFirst({
      where: {
        email: { equals: suggestion.email, mode: "insensitive" },
        link: { organizationId: organization.id },
        unsubscribedAt: { not: null },
      },
      select: { id: true },
    }),
  ]);
  if (blocked.size > 0 || unsubscribed) return { error: t("doNotContact") };

  let linkId = suggestion.linkId;
  const abandoned = linkId === CREATING && suggestion.updatedAt < new Date(Date.now() - CREATING_TIMEOUT_MS);
  if (!linkId || abandoned) {
    // Claimed first: a double click must not create two links
    const { count } = await prisma.prospectSuggestion.updateMany({
      where: { id: suggestion.id, linkId: suggestion.linkId, updatedAt: suggestion.updatedAt },
      data: { linkId: CREATING },
    });
    if (count === 0) return { error: t("linkBeingCreated") };

    const link = await createDocumentLink({
      organizationId: organization.id,
      userId: user.id,
      documentId: z.string().min(1).parse(documentId),
      prospect: {
        email: suggestion.email,
        name: [suggestion.firstName, suggestion.lastName].filter(Boolean).join(" ") || null,
        company: suggestion.companyName,
        origin: "PROSPECTING",
      },
      source: "prospecting",
      followupsEnabled: false,
      draft: true,
    }).catch((error) => (error instanceof PlanLimitError ? error : null));
    const created = link instanceof PlanLimitError ? null : link;
    await prisma.prospectSuggestion.update({ where: { id: suggestion.id }, data: { linkId: created?.id ?? null } });
    if (link instanceof PlanLimitError) return upgradePrompt("links", { max: link.max ?? 0 });
    if (!created) return { error: t("documentNotFound") };
    linkId = created.id;
  } else if (linkId === CREATING) {
    return { error: t("linkBeingCreated") };
  }

  const link = await prisma.link.findFirst({
    where: { id: linkId, organizationId: organization.id, archivedAt: null },
    select: {
      slug: true,
      draftAt: true,
      document: { select: { name: true, displayTitle: true, docType: true } },
      prospects: { where: { origin: "PROSPECTING" }, select: { id: true }, take: 1 },
    },
  });
  if (!link || link.prospects.length === 0) {
    await prisma.prospectSuggestion.update({ where: { id: suggestion.id }, data: { linkId: null, hookSubject: null, hookBody: null } });
    return { error: t("linkArchived") };
  }
  const { url, title } = shareLink(getPublicAppUrl(), { slug: link.slug, document: link.document, company: suggestion.companyName });

  let subject = suggestion.hookSubject;
  let message = suggestion.hookBody;
  if (!subject || !message) {
    const draft = await draftOutreach({
      organizationId: organization.id,
      linkId,
      proposalUrl: url,
      documentTitle: link.document.displayTitle || link.document.name,
      prospect: { firstName: suggestion.firstName, title: suggestion.title, company: suggestion.companyName },
      prospectSiren: suggestion.companySiren,
    });
    subject = draft.subject;
    message = draft.body;
    await prisma.prospectSuggestion.update({
      where: { id: suggestion.id },
      data: { hookSubject: subject, hookBody: message },
    });
  }

  const settings = await prisma.workspaceSettings.findUnique({
    where: { organizationId: organization.id },
    select: { senderName: true, senderSignature: true },
  });
  const footer = outreachFooter({
    signature: settings?.senderSignature ?? null,
    senderName: settings?.senderName ?? user.name,
    unsubscribeUrl: unsubscribePageUrl(link.prospects[0].id),
  });

  revalidatePath("/prospecting");
  return { linkId, url, title, email: suggestion.email, subject, body: `${message}\n\n${footer}`, draft: !!link.draftAt };
}

/** The seller sent the message from their mailbox: the deal starts now. */
export async function markOutreachSentAction(linkId: string): Promise<ActionResult> {
  const { organization } = await requireProspecting();
  const confirmed = await confirmLinkSent({ organizationId: organization.id, linkId });
  if (!confirmed) return { error: (await getTranslations("prospecting.actions"))("linkNotFound") };
  revalidatePath("/prospecting");
  revalidatePath("/dashboard");
  return { ok: true };
}
