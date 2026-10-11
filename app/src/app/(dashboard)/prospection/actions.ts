"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireProspecting } from "@/lib/prospecting/flag";
import { inferWorkspaceTarget } from "@/lib/prospecting/infer/collect";
import { splitList, targetFiltersSchema, type TargetFilters } from "@/lib/prospecting/target";
import { saveTarget } from "@/lib/prospecting/targets";

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
