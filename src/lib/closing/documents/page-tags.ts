import type { PageTag } from "@/generated/prisma/enums";

type Rule = { tag: PageTag; patterns: RegExp[]; minHits: number };

// Keyword heuristics (fr / en / es / de). Good enough to spot the pricing page
// without an LLM; AI tagging can refine this later.
const RULES: Rule[] = [
  {
    tag: "PRICING",
    minHits: 2,
    patterns: [
      /\d[\d\s.,]*\s?(€|eur\b|euros?\b|\$|usd\b|£|chf\b)/g,
      /(€|\$|£)\s?\d/g,
      /\b(prix|tarifs?|tarification|montant|total\s+(ht|ttc)|tva|remise|price|pricing|fees?|investissement|investment|budget|devis|quote|precio|preis|kosten)\b/g,
    ],
  },
  {
    tag: "TERMS",
    minHits: 2,
    patterns: [
      /\b(conditions?\s+g[ée]n[ée]rales|cgv|conditions\s+de\s+paiement|modalit[ée]s|[ée]ch[ée]ance|acompte|terms\s+and\s+conditions|payment\s+terms|validit[ée]|signature)\b/g,
    ],
  },
  {
    tag: "TIMELINE",
    minHits: 2,
    patterns: [
      /\b(planning|calendrier|r[ée]troplanning|timeline|roadmap|jalons?|milestones?|d[ée]lais?|semaines?|weeks?|phase\s+\d|sprint)\b/g,
    ],
  },
  {
    tag: "SCOPE",
    minHits: 2,
    patterns: [
      /\b(p[ée]rim[èe]tre|scope|livrables?|deliverables?|prestations?|fonctionnalit[ée]s|features|inclus|included)\b/g,
    ],
  },
  {
    tag: "TEAM",
    minHits: 2,
    patterns: [
      /\b([ée]quipe|team|qui\s+sommes[-\s]nous|about\s+us|chef\s+de\s+projet|project\s+manager|consultants?)\b/g,
    ],
  },
  {
    tag: "CASE_STUDY",
    minHits: 2,
    patterns: [
      /\b(r[ée]f[ée]rences?|cas\s+clients?|case\s+stud(y|ies)|t[ée]moignages?|testimonials?|ils\s+nous\s+font\s+confiance)\b/g,
    ],
  },
];

export function detectPageTags(text: string): PageTag[] {
  const lower = text.toLowerCase();
  const tags: PageTag[] = [];

  for (const rule of RULES) {
    const hits = rule.patterns.reduce(
      (count, pattern) => count + (lower.match(pattern)?.length ?? 0),
      0,
    );
    if (hits >= rule.minHits) tags.push(rule.tag);
  }

  return tags;
}
