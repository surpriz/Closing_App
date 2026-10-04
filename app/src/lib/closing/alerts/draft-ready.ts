import { createAndDeliverAlert } from "./send-alert";

/**
 * Tells the seller a follow-up waits for them. Grouped: one alert per hour per
 * workspace at most, the dashboard lists the others.
 */
export function notifyDraftReady(linkId: string, organizationId: string, now: Date) {
  const hour = now.toISOString().slice(0, 13);
  return createAndDeliverAlert({
    linkId,
    type: "DRAFT_READY",
    dedupeKey: `draft_ready:${organizationId}:${hour}`,
    payload: {},
  });
}
