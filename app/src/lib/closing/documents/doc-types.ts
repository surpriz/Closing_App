import type { PageTag } from "@/generated/prisma/enums";

/**
 * Kinds of documents sellers send, and what the six page tags mean for each.
 * Pure. The tags stay the same in the database (the analysis reasons on
 * them); only their meaning and their name on screen change: on a résumé,
 * "PRICING" is the day rate and "CASE_STUDY" the past missions.
 */

export const DOC_TYPES = [
  "QUOTE",
  "PROPOSAL",
  "PRESENTATION",
  "TECHNICAL",
  "RESUME",
  "INVOICE",
  "CONTRACT",
  "CASE_STUDY",
  "BROCHURE",
  "OTHER",
] as const;
export type DocType = (typeof DOC_TYPES)[number];

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  QUOTE: "Devis",
  PROPOSAL: "Proposition commerciale",
  PRESENTATION: "Présentation",
  TECHNICAL: "Document technique",
  RESUME: "CV / profil",
  INVOICE: "Facture",
  CONTRACT: "Contrat",
  CASE_STUDY: "Étude de cas",
  BROCHURE: "Plaquette",
  OTHER: "Document",
};

type TaggedTag = Exclude<PageTag, "OTHER">;

const DEFAULT_TAGS: Record<TaggedTag, { label: string; meaning: string }> = {
  PRICING: { label: "Tarifs", meaning: "prices, quote lines, totals, payment amounts" },
  TERMS: { label: "Conditions", meaning: "conditions, payment terms, validity, signature" },
  TIMELINE: { label: "Planning", meaning: "planning, phases, deadlines" },
  SCOPE: { label: "Périmètre", meaning: "deliverables, features, what is included" },
  TEAM: { label: "Équipe", meaning: "people, company presentation" },
  CASE_STUDY: { label: "Références", meaning: "references, client cases, testimonials" },
};

const OVERRIDES: Partial<Record<DocType, Partial<Record<TaggedTag, { label: string; meaning: string }>>>> = {
  RESUME: {
    PRICING: { label: "Tarif / TJM", meaning: "day rate, salary or price expectations" },
    TERMS: { label: "Conditions", meaning: "contract type, remote work, location constraints" },
    TIMELINE: { label: "Disponibilité", meaning: "availability, start date, notice period" },
    SCOPE: { label: "Compétences", meaning: "skills, technologies, certifications" },
    TEAM: { label: "Profil", meaning: "who the person is: summary, contact, education" },
    CASE_STUDY: { label: "Expériences", meaning: "past jobs, missions and their results" },
  },
  TECHNICAL: {
    PRICING: { label: "Coûts", meaning: "costs, effort or budget estimates" },
    TERMS: { label: "Hypothèses", meaning: "assumptions, prerequisites, constraints, risks" },
    TIMELINE: { label: "Plan d'action", meaning: "roadmap, priorities, phases, next steps" },
    SCOPE: { label: "Constats", meaning: "findings, recommendations, what is covered" },
  },
  INVOICE: {
    PRICING: { label: "Montants", meaning: "invoice lines, totals, taxes" },
    TERMS: { label: "Échéances", meaning: "due date, payment terms, penalties" },
  },
  CONTRACT: {
    TERMS: { label: "Clauses", meaning: "clauses, obligations, termination, liability" },
  },
  CASE_STUDY: {
    CASE_STUDY: { label: "Résultats", meaning: "results, figures, client quotes" },
    SCOPE: { label: "Solution", meaning: "what was done for the client" },
  },
};

export function tagDefinitions(docType: string | null | undefined) {
  const overrides = OVERRIDES[(docType ?? "OTHER") as DocType] ?? {};
  return Object.fromEntries(
    (Object.keys(DEFAULT_TAGS) as TaggedTag[]).map((tag) => [tag, overrides[tag] ?? DEFAULT_TAGS[tag]]),
  ) as Record<TaggedTag, { label: string; meaning: string }>;
}

/** Page tag names for the seller, adapted to the document type. */
export function tagLabels(docType: string | null | undefined): Record<PageTag, string> {
  const defs = tagDefinitions(docType);
  return { ...Object.fromEntries(Object.entries(defs).map(([tag, def]) => [tag, def.label])), OTHER: "Autre" } as Record<
    PageTag,
    string
  >;
}

/** How the deal analysis should read this kind of document. */
export const DOC_TYPE_GUIDANCE: Partial<Record<DocType, string>> = {
  RESUME:
    "The document is a résumé: the salesperson sells themselves (freelance or candidate). Interest shows in the experience and skills sections; time on the rate or availability means the reader is considering a concrete mission. The usual next step is an interview or a call.",
  INVOICE:
    "The document is an invoice: the goal is payment, not a decision. Re-reading the amounts or terms may mean a question or a dispute.",
  CONTRACT:
    "The document is a contract: reading clauses repeatedly often means legal review or negotiation of specific terms.",
  CASE_STUDY:
    "The document is a case study used to build trust: deep reading of results means the reader is checking credibility before engaging.",
  TECHNICAL:
    "The document is a technical document (audit, specification, study): the reader is checking the expertise and the plan. Rereading the findings or the action plan means they are weighing the work; time on costs means they are budgeting it. The usual next step is a call to go through the recommendations.",
  BROCHURE: "The document is a brochure: early-stage discovery, a call or meeting is the natural next step.",
};
