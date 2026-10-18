import type { DealStatus, ProspectOrigin, SellerAlertType } from "@/generated/prisma/enums";

import { extensionRequestKey, isLinkExpired, viewerDeadline } from "./expiry";

/**
 * A prospect coming back to a link that no longer opens: the interest is back.
 * Pure, shared by the viewer, the alerts and the dashboard. The viewer's
 * beacon imports it too: no server import here.
 */

/** Why the link no longer opens, and since when. The date is in every key: a new death re-arms everything. */
export type DeadState = { kind: "archived" | "expired"; since: Date };

/** Archived wins over expired: the seller withdrew it, more time would not open it. */
export function deadState(
  link: {
    archivedAt: Date | null;
    expiresAt: Date | null;
    dealStatus: DealStatus;
    document: { archivedAt: Date | null };
  },
  now: Date,
): DeadState | null {
  const archivedAt = link.archivedAt ?? link.document.archivedAt;
  if (archivedAt) return { kind: "archived", since: archivedAt };
  const deadline = viewerDeadline(link);
  if (deadline && isLinkExpired({ expiresAt: deadline }, now)) return { kind: "expired", since: deadline };
  return null;
}

/** What the prospect's click records, per state. */
export const REVIVAL_ACTION = { expired: "REQUEST_EXTENSION", archived: "REQUEST_RELINK" } as const;
export const REVIVAL_ALERT = { expired: "LINK_EXTENSION_REQUESTED", archived: "RELINK_REQUESTED" } as const;

/** Every alert saying a prospect came back to a dead link. */
export const REVIVAL_ALERT_TYPES = [
  "DEAD_LINK_OPENED",
  "RELINK_REQUESTED",
  "LINK_EXTENSION_REQUESTED",
] as const satisfies readonly SellerAlertType[];

/** Expired keeps the extension key it always had: requests made before this still dedupe. */
export function revivalRequestKey(linkId: string, dead: DeadState, who: string) {
  if (dead.kind === "expired") return extensionRequestKey(linkId, dead.since, who);
  return `relink_request:${linkId}:${dead.since.getTime()}:${who}`;
}

export function deadOpenKey(linkId: string, dead: DeadState, who: string) {
  return `dead_open:${linkId}:${dead.kind}:${dead.since.getTime()}:${who}`;
}

/** One signal per person: known by email, else by browser, else by network. */
export function revivalWho(input: { prospectId?: string | null; visitorId?: string | null; ipHash?: string | null }) {
  return input.prospectId || input.visitorId || input.ipHash || "anonymous";
}

export type RevivalSignal = { at: Date; asked: boolean; state: DeadState["kind"] };

/** The latest return to this dead link, if it came after the link died: an older one is about a previous life. */
export function revivalSignal(
  dead: DeadState | null,
  latest: { type: SellerAlertType; createdAt: Date } | null,
): RevivalSignal | null {
  if (!dead || !latest || latest.createdAt.getTime() < dead.since.getTime()) return null;
  return { at: latest.createdAt, asked: latest.type !== "DEAD_LINK_OPENED", state: dead.kind };
}

/**
 * Who the "available again" draft goes to, or null for none. An open deal only
 * (the dispatcher cancels the rest), never someone the reactivation email
 * already told, and only people the seller sent it to: an email typed on a
 * dead page proves nothing.
 */
export function interestFollowupTarget(
  input: InterestDeal & { told: readonly string[]; returned: readonly string[] },
) {
  const candidates = interestCandidates(input);
  if (candidates.some((p) => input.told.includes(p.id))) return null;
  return (candidates.find((p) => input.returned.includes(p.id)) ?? candidates[0])?.id ?? null;
}

/** Whether "Réactiver" can offer the draft at all, before knowing who the email told. */
export function canDraftInterestFollowup(deal: InterestDeal) {
  return interestCandidates(deal).length > 0;
}

type InterestDeal = {
  dealStatus: DealStatus;
  followupsEnabled: boolean;
  meetingBookedAt: Date | null;
  quoteRequestedAt: Date | null;
  prospects: readonly { id: string; origin: ProspectOrigin; unsubscribedAt: Date | null }[];
};

function interestCandidates(deal: InterestDeal) {
  if (deal.dealStatus !== "OPEN" || !deal.followupsEnabled) return [];
  if (deal.meetingBookedAt || deal.quoteRequestedAt) return [];
  return deal.prospects.filter((p) => p.origin === "SELLER" && !p.unsubscribedAt);
}

/** Revival alerts pushed per link per hour, of each kind; beyond that they are only stored. */
export const REVIVAL_ALERTS_PER_LINK_HOUR = 3;
/** Requests or returns recorded per link per hour; a real buying team stays far below, beyond that nothing is. */
export const REVIVAL_RECORDS_PER_LINK_HOUR = 20;
/** The beacon goes when the reader leaves, or after this long on the page. */
export const DEAD_OPEN_DWELL_MS = 20_000;
/** Below this, it was a prefetch or a misclick, not someone reading. */
export const DEAD_OPEN_MIN_MS = 1_500;
/** How long a revived dead deal stays in the seller's Today. */
export const REVIVAL_VISIBLE_DAYS = 14;
