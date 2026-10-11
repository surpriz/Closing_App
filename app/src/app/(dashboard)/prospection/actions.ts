"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { inBackground } from "@/lib/closing/background";
import { prisma } from "@/lib/db";
import { availableProviders } from "@/lib/prospecting/credentials";
import { requireProspecting } from "@/lib/prospecting/flag";
import { inferWorkspaceTarget } from "@/lib/prospecting/infer/collect";
import { addOptOut } from "@/lib/prospecting/opt-out";
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

/** Starts a search on the active target; the page follows the run until it is done. */
export async function startSearchAction(provider: string): Promise<ActionResult> {
  const { organization } = await requireProspecting();
  const name = providerSchema.parse(provider);
  if (!availableProviders(organization.id).includes(name)) return { error: "Ce fournisseur n'est pas configuré." };

  const target = await activeTarget(organization.id);
  if (!target || !targetIsSearchable(filtersOf(target))) {
    return { error: "Indiquez au moins un secteur et des postes ou niveaux visés." };
  }
  const running = await prisma.prospectingRun.count({
    where: { organizationId: organization.id, status: "RUNNING" },
  });
  if (running > 0) return { error: "Une recherche est déjà en cours." };

  const run = await startRun({ organizationId: organization.id, targetProfileId: target.id, provider: name });
  inBackground("prospecting-search", () => runSearch(run.id));
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
