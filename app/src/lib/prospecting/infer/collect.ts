import { isPersonalEmail } from "@/lib/closing/prospects/from-recipient";
import { prisma } from "@/lib/db";

import { lookupDomain } from "../sirene/lookup";
import { inferTarget, type DealCompany } from "./aggregate";

// Sales documents only: a résumé or an invoice says nothing about who buys
const SALES_DOC_TYPES = ["QUOTE", "PROPOSAL", "PRESENTATION"];
const MAX_LINKS = 300;
// Each new domain is one registry call (7/s): keep the seller's wait short
const MAX_DOMAINS = 40;

/**
 * Target deduced from the companies the seller already sent quotes and presentations to.
 * Also returns their domains: they are customers or prospects already, never suggestions.
 */
export async function inferWorkspaceTarget(organizationId: string, now = new Date()) {
  const links = await prisma.link.findMany({
    where: {
      organizationId,
      archivedAt: null,
      draftAt: null,
      shared: false,
      document: { docType: { in: SALES_DOC_TYPES } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_LINKS,
    select: {
      dealStatus: true,
      engagementScore: { select: { score: true } },
      prospects: { select: { email: true } },
    },
  });

  const byDomain = new Map<string, { score: number; won: boolean }>();
  for (const link of links) {
    for (const { email } of link.prospects) {
      if (isPersonalEmail(email)) continue;
      const domain = email.split("@")[1].toLowerCase();
      const current = byDomain.get(domain) ?? { score: 0, won: false };
      byDomain.set(domain, {
        score: Math.max(current.score, link.engagementScore?.score ?? 0),
        won: current.won || link.dealStatus === "WON",
      });
    }
  }

  // Won deals and engaged readers first, in case the list is cut
  const domains = [...byDomain.entries()]
    .sort(([, a], [, b]) => Number(b.won) - Number(a.won) || b.score - a.score)
    .slice(0, MAX_DOMAINS);

  const deals: DealCompany[] = [];
  for (const [domain, signal] of domains) {
    const record = await lookupDomain(domain, now)?.catch(() => null);
    deals.push({
      domain,
      company: record?.siren ? record : null,
      confidence: record?.confidence ?? 0,
      ...signal,
    });
  }

  return { ...inferTarget(deals), customerDomains: [...byDomain.keys()] };
}
