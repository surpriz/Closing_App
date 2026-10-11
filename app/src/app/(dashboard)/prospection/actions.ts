"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getPublicAppUrl } from "@/lib/app-origin";
import { inBackground } from "@/lib/closing/background";
import { confirmLinkSent, createDocumentLink } from "@/lib/closing/documents/create-link";
import { unsubscribePageUrl } from "@/lib/closing/unsubscribe";
import { prisma } from "@/lib/db";
import { availableProviders } from "@/lib/prospecting/credentials";
import { requireProspecting } from "@/lib/prospecting/flag";
import { getEnv } from "@/lib/env";
import { inferWorkspaceTarget } from "@/lib/prospecting/infer/collect";
import { revealsStartedToday } from "@/lib/prospecting/ledger";
import { draftOutreach } from "@/lib/prospecting/hook";
import { outreachFooter } from "@/lib/prospecting/hook-prompt";
import { addOptOut } from "@/lib/prospecting/opt-out";
import { revealAllowance } from "@/lib/prospecting/quota";
import { startReveals } from "@/lib/prospecting/reveal";
import { runSearch, startRun } from "@/lib/prospecting/search";
import { splitList, targetFiltersSchema, targetIsSearchable, type TargetFilters } from "@/lib/prospecting/target";
import { activeTarget, filtersOf, saveTarget } from "@/lib/prospecting/targets";

export type ProspectingFormState = { ok?: boolean; error?: string } | null;

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

export async function saveTargetAction(_prev: ProspectingFormState, formData: FormData): Promise<ProspectingFormState> {
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
  if (!parsed.success) return { error: "Un des champs est trop long ou contient trop de valeurs." };

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
  revalidatePath("/prospection");
  return { ok: true };
}

/** Proposed target from the seller's deals; nothing is saved until the seller checks it. */
export async function deduceTargetAction(): Promise<DeducedTarget> {
  const { organization } = await requireProspecting();
  const inferred = await inferWorkspaceTarget(organization.id);

  if (inferred.evidence.recognized === 0) {
    return {
      error: inferred.evidence.domains
        ? "Clozer n'a reconnu aucune entreprise parmi vos prospects. Saisissez votre cible à la main."
        : "Pas encore de devis ou de présentation envoyés à une adresse professionnelle.",
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

export type ActionResult = { ok: true } | { error: string };

const providerSchema = z.enum(["APOLLO", "LEMLIST", "MOCK"]);

/**
 * Starts a search on the active target; the page follows the run until it is done. Several
 * providers at once share a comparisonId and run one after the other on the same target.
 */
export async function startSearchAction(providers: string[]): Promise<ActionResult> {
  const { organization } = await requireProspecting();
  const names = z.array(providerSchema).min(1).max(3).parse(providers);
  const available = availableProviders(organization.id);
  if (names.some((name) => !available.includes(name))) return { error: "Ce fournisseur n'est pas configuré." };

  const target = await activeTarget(organization.id);
  if (!target || !targetIsSearchable(filtersOf(target))) {
    return { error: "Indiquez au moins un secteur et des postes ou niveaux visés." };
  }
  const running = await prisma.prospectingRun.count({
    where: { organizationId: organization.id, status: "RUNNING" },
  });
  if (running > 0) return { error: "Une recherche est déjà en cours." };

  const comparisonId = names.length > 1 ? crypto.randomUUID() : null;
  const runIds: string[] = [];
  for (const provider of names) {
    const run = await startRun({ organizationId: organization.id, targetProfileId: target.id, provider, comparisonId });
    runIds.push(run.id);
  }
  inBackground("prospecting-search", async () => {
    for (const runId of runIds) await runSearch(runId);
  });
  revalidatePath("/prospection");
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
  const suggestion = await ownedSuggestion(organization.id, suggestionId);
  if (suggestion.status !== "SUGGESTED") return { error: "Cette suggestion a déjà été traitée." };

  await prisma.prospectSuggestion.update({
    where: { id: suggestion.id },
    data: { status: "REJECTED", decidedAt: new Date(), decidedById: user.id },
  });
  revalidatePath("/prospection");
  return { ok: true };
}

/** The person asked not to be contacted: never suggested again, to anyone. */
export async function optOutSuggestionAction(suggestionId: string): Promise<ActionResult> {
  const { user, organization } = await requireProspecting();
  const suggestion = await ownedSuggestion(organization.id, suggestionId);

  await addOptOut(
    {
      email: suggestion.email,
      linkedinUrl: suggestion.linkedinUrl,
      provider: suggestion.provider,
      externalId: suggestion.externalId,
    },
    "seller",
  );
  await prisma.prospectSuggestion.update({
    where: { id: suggestion.id },
    data: {
      status: "REJECTED",
      decidedAt: new Date(),
      decidedById: user.id,
      // Nothing personal is kept about someone who said no
      email: null,
      lastName: null,
      linkedinUrl: null,
      hookSubject: null,
      hookBody: null,
    },
  });
  revalidatePath("/prospection");
  return { ok: true };
}

/** Accepted contacts are revealed (provider credits) in the background, within the daily cap. */
export async function acceptSuggestionsAction(suggestionIds: string[]): Promise<ActionResult> {
  const { user, organization } = await requireProspecting();
  const ids = z.array(z.string().min(1)).min(1).max(50).parse(suggestionIds);
  const now = new Date();

  const open = await prisma.prospectSuggestion.findMany({
    where: { id: { in: ids }, organizationId: organization.id, status: "SUGGESTED" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (open.length === 0) return { error: "Ces suggestions ont déjà été traitées." };

  const allowed = revealAllowance({
    revealsToday: await revealsStartedToday(organization.id, now),
    requested: open.length,
    dailyLimit: getEnv().PROSPECTING_DAILY_REVEAL_LIMIT,
  });
  if (allowed === 0) return { error: "Limite de révélations du jour atteinte. Reprenez demain." };

  const accepted = open.slice(0, allowed).map((s) => s.id);
  await prisma.prospectSuggestion.updateMany({
    where: { id: { in: accepted }, status: "SUGGESTED" },
    data: { status: "REVEALING", decidedAt: now, decidedById: user.id, revealStartedAt: now },
  });
  inBackground("prospecting-reveal", () => startReveals(accepted, now));
  revalidatePath("/prospection");
  return allowed < open.length
    ? { error: `${allowed} contact${allowed > 1 ? "s" : ""} en cours de révélation, la limite du jour est atteinte pour les autres.` }
    : { ok: true };
}

export type OutreachResult =
  | { linkId: string; url: string; email: string; subject: string; body: string; draft: boolean }
  | { error: string };

/**
 * A tracked link for a ready contact, with a first message the seller sends from their own
 * mailbox. The link stays a draft until the seller says it was sent (or the contact opens it),
 * and Clozer never sends follow-ups on its own to someone who never asked to hear from us.
 */
export async function createOutreachLinkAction(suggestionId: string, documentId: string): Promise<OutreachResult> {
  const { user, organization } = await requireProspecting();
  const suggestion = await ownedSuggestion(organization.id, suggestionId);
  if (suggestion.status !== "READY" || !suggestion.email) return { error: "Ce contact n'est pas prêt." };

  let linkId = suggestion.linkId;
  if (!linkId) {
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
      draft: true,
    });
    if (!link) return { error: "Document introuvable." };
    await prisma.link.update({ where: { id: link.id }, data: { followupsEnabled: false } });
    await prisma.prospectSuggestion.update({ where: { id: suggestion.id }, data: { linkId: link.id } });
    linkId = link.id;
  }

  const link = await prisma.link.findUniqueOrThrow({
    where: { id: linkId },
    select: {
      slug: true,
      draftAt: true,
      document: { select: { name: true, displayTitle: true } },
      prospects: { select: { id: true }, take: 1 },
    },
  });
  const url = `${getPublicAppUrl()}/v/${link.slug}`;

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

  revalidatePath("/prospection");
  return { linkId, url, email: suggestion.email, subject, body: `${message}\n\n${footer}`, draft: !!link.draftAt };
}

/** The seller sent the message from their mailbox: the deal starts now. */
export async function markOutreachSentAction(linkId: string): Promise<ActionResult> {
  const { organization } = await requireProspecting();
  const confirmed = await confirmLinkSent({ organizationId: organization.id, linkId });
  if (!confirmed) return { error: "Lien introuvable." };
  revalidatePath("/prospection");
  revalidatePath("/dashboard");
  return { ok: true };
}
