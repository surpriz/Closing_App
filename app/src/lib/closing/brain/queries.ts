import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";

import { DAY_MS } from "../constants";
import type { DealFactsInput } from "./facts";
import type { AnalyzerDeal, AnalyzerProfile } from "./prompts";

/** Everything the deal analysis reads, in one place. No logic beyond shaping rows. */
export async function loadDealForAnalysis(linkId: string, now: Date) {
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    include: {
      organization: { include: { settings: true } },
      document: {
        select: {
          name: true,
          kind: true,
          sellerDescription: true,
          docType: true,
          docPurpose: true,
          pages: {
            select: { pageNumber: true, tags: true, summary: true, text: true },
            orderBy: { pageNumber: "asc" },
          },
        },
      },
      prospects: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, company: true } },
      views: {
        where: { isBot: false },
        orderBy: { startedAt: "asc" },
        select: {
          id: true,
          visitorId: true,
          prospectId: true,
          startedAt: true,
          lastSeenAt: true,
          totalDurationMs: true,
          deviceType: true,
          country: true,
          timezone: true,
          maxPageReached: true,
          pageViews: { select: { pageNumber: true, totalDurationMs: true } },
        },
      },
      actions: { orderBy: { createdAt: "asc" }, select: { type: true, message: true, createdAt: true, prospectId: true } },
      followups: {
        where: { status: { in: ["SENT", "DELIVERED"] }, sentAt: { not: null } },
        orderBy: { sentAt: "asc" },
        select: { sentAt: true, channel: true, subject: true, sentVia: true },
      },
      sellerActivities: { orderBy: { occurredAt: "asc" }, select: { type: true, note: true, occurredAt: true } },
      engagementScore: { select: { score: true, tier: true } },
    },
  });
  if (!link) return null;

  const settings = link.organization.settings;
  const sentLast30Days = link.followups.filter((f) => f.sentAt!.getTime() >= now.getTime() - 30 * DAY_MS).length;

  const facts: DealFactsInput = {
    now,
    defaultTimezone: getEnv().DEFAULT_TIMEZONE,
    businessHours: {
      start: link.businessHourStart ?? settings?.businessHourStart ?? 9,
      end: link.businessHourEnd ?? settings?.businessHourEnd ?? 18,
      days: settings?.businessDays ?? [1, 2, 3, 4, 5],
    },
    deal: {
      sentAt: link.sentAt,
      createdAt: link.createdAt,
      dealStatus: link.dealStatus,
      dealAmountCents: link.dealAmountCents,
      dealCurrency: link.dealCurrency,
      decisionDeadline: link.decisionDeadline,
      expiresAt: link.expiresAt,
    },
    document: {
      name: link.document.name,
      kind: link.document.kind,
      docType: link.document.docType,
      pages: link.document.pages.map((page) => ({
        pageNumber: page.pageNumber,
        tags: page.tags,
        summary: page.summary,
        wordCount: page.text ? page.text.split(/\s+/).filter(Boolean).length : 0,
      })),
    },
    prospects: link.prospects,
    views: link.views.map(({ pageViews, ...view }) => ({ ...view, pages: pageViews })),
    actions: link.actions,
    followups: link.followups.map((f) => ({ ...f, sentAt: f.sentAt! })),
    sellerActivities: link.sellerActivities,
    score: link.engagementScore,
  };

  const profile: AnalyzerProfile = {
    offerDescription: settings?.offerDescription ?? null,
    targetCustomer: settings?.targetCustomer ?? null,
    valueProps: settings?.valueProps ?? null,
    commonObjections: settings?.commonObjections ?? null,
    avgSalesCycleDays: settings?.avgSalesCycleDays ?? null,
  };

  const deal: AnalyzerDeal = {
    documentName: link.document.name,
    documentKind: link.document.kind,
    docType: link.document.docType,
    docPurpose: link.document.docPurpose,
    sellerDescription: link.document.sellerDescription,
    pages: link.document.pages.map(({ pageNumber, tags, summary }) => ({ pageNumber, tags, summary })),
    dealStatus: link.dealStatus,
    dealAmount:
      link.dealAmountCents !== null
        ? new Intl.NumberFormat("fr-FR", { style: "currency", currency: link.dealCurrency ?? "EUR" }).format(
            link.dealAmountCents / 100,
          )
        : null,
    decisionMaker: [link.decisionMakerName, link.decisionMakerRole].filter(Boolean).join(", ") || null,
    sellerNotes: link.sellerNotes,
    followupBudget: { sentLast30Days, max: settings?.maxFollowupsPer30Days ?? 3 },
  };

  return {
    link: {
      id: link.id,
      organizationId: link.organizationId,
      dealStatus: link.dealStatus,
      archivedAt: link.archivedAt,
      expiresAt: link.expiresAt,
      // Context the seller can change: a change means a fresh analysis
      contextKey: JSON.stringify([
        link.decisionMakerName,
        link.decisionMakerRole,
        link.sellerNotes,
        link.decisionDeadline?.getTime() ?? null,
        settings?.offerDescription ?? null,
        settings?.avgSalesCycleDays ?? null,
      ]),
    },
    facts,
    profile,
    deal,
  };
}
