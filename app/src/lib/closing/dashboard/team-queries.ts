import { prisma } from "@/lib/db";
import { isOwnerRole } from "@/lib/roles";

import { getWorkspaceLiveState } from "../live";
import { dealAction } from "./deal-action";
import { prospectLabel } from "./labels";
import { getOpenDeals } from "./queries";
import { classifyDeal, summarizeBySeller } from "./team";

/** Open deals the team page reads; beyond that the counts undercount. */
const TEAM_DEALS_TAKE = 500;

/**
 * Everything the manager's page shows: each open deal of the workspace with
 * its seller and verdict, and one summary line per seller.
 */
export async function getTeamBoard(organizationId: string, now: Date) {
  const [deals, members, live] = await Promise.all([
    getOpenDeals(organizationId, { take: TEAM_DEALS_TAKE }),
    prisma.member.findMany({
      where: { organizationId },
      orderBy: { createdAt: "asc" },
      select: { userId: true, role: true, user: { select: { name: true, email: true } } },
    }),
    getWorkspaceLiveState(organizationId, now),
  ]);

  const sellers = members.map((member) => ({
    id: member.userId,
    name: member.user.name || member.user.email,
  }));
  const memberIds = new Set(sellers.map((seller) => seller.id));
  // Links nobody owns any more go to the owner, as their alerts do
  const fallbackId = members.find((member) => isOwnerRole(member.role))?.userId ?? sellers[0]?.id ?? "";
  const readingLinks = new Set(live.readers.map((reader) => reader.linkId));

  const rows = deals.map((deal) => {
    const readingNow = readingLinks.has(deal.id);
    const { action, tier, score, insightHeadline, aiPriority } = dealAction(deal, now, readingNow);
    const { health, signals } = classifyDeal(deal, now, readingNow);
    return {
      id: deal.id,
      label: prospectLabel(deal),
      documentName: deal.document.name,
      sellerId: deal.createdById && memberIds.has(deal.createdById) ? deal.createdById : fallbackId,
      tier,
      score,
      health,
      signals,
      action,
      aiPriority,
      insightHeadline,
      lastActivityAt: deal.lastActivityAt,
      amountCents: deal.dealAmountCents,
      currency: deal.dealCurrency,
    };
  });

  return {
    sellers,
    rows,
    summaries: summarizeBySeller(rows),
    capped: deals.length === TEAM_DEALS_TAKE,
  };
}

export type TeamBoard = Awaited<ReturnType<typeof getTeamBoard>>;
export type TeamDealRow = TeamBoard["rows"][number];
