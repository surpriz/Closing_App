// Pure recognition of the messages Calendly and Cal.com widgets post to the
// page that frames them. Calendly: https://calendly.com/help/advanced-calendly-embed-for-developers
// Cal.com: packages/embeds/embed-core (sdk-action-manager.ts, embed-iframe.ts).

import { BOOKING_ORIGINS, CAL_NAMESPACE, type BookingProvider } from "./url";

export type BookingMessage =
  | { kind: "booked"; startTime: string | null }
  // Cal.com only: its page stays hidden until we answer this
  | { kind: "cal_handshake" }
  | { kind: "loaded" }
  | { kind: "failed" }
  | { kind: "resize"; height: number };

const CALENDLY_BOOKED = "calendly.event_scheduled";
const CALENDLY_LOADED = ["calendly.profile_page_viewed", "calendly.event_type_viewed"];
// bookingSuccessful is deprecated but still fired by older deployments.
// Dry-run (test mode) bookings are left out on purpose.
const CAL_BOOKED = ["bookingSuccessfulV2", "bookingSuccessful"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isoOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

/** Null for anything that is not a message we trust from that provider. */
export function parseBookingMessage(
  message: { origin: string; data: unknown },
  provider: BookingProvider,
): BookingMessage | null {
  if (provider === "external") return null;
  if (!BOOKING_ORIGINS[provider].includes(message.origin)) return null;
  const data = message.data;
  if (!isRecord(data)) return null;

  if (provider === "calendly") {
    if (data.event === CALENDLY_BOOKED) return { kind: "booked", startTime: null };
    if (typeof data.event === "string" && CALENDLY_LOADED.includes(data.event)) return { kind: "loaded" };
    return null;
  }

  if (data.originator !== "CAL" || data.namespace !== CAL_NAMESPACE || typeof data.type !== "string") return null;
  const payload = isRecord(data.data) ? data.data : {};
  if (CAL_BOOKED.includes(data.type)) return { kind: "booked", startTime: isoOrNull(payload.startTime) };
  if (data.type === "__iframeReady") return { kind: "cal_handshake" };
  if (data.type === "linkReady") return { kind: "loaded" };
  if (data.type === "linkFailed") return { kind: "failed" };
  if (data.type === "__dimensionChanged" && typeof payload.iframeHeight === "number" && payload.iframeHeight > 0) {
    return { kind: "resize", height: Math.round(payload.iframeHeight) };
  }
  return null;
}

/** What the parent posts back to a Cal.com iframe after `__iframeReady`. */
export const CAL_PARENT_READY = { originator: "CAL", method: "parentKnowsIframeReady", arg: {} } as const;
