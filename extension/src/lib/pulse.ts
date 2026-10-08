// What GET /api/ext/pulse returns, and the pure decisions made on it:
// which alerts become a Chrome notification, what the badge says.

export type PulseReader = {
  viewId: string;
  linkId: string;
  label: string;
  name: string | null;
  currentPage: number | null;
  startedAt: string;
};

export type PulseAlert = {
  id: string;
  type: string;
  priority: "ACTION" | "CALL" | "INFO";
  linkId: string;
  url: string;
  title: string;
  body: string;
  createdAt: string;
};

export type Pulse = { enabled: boolean; readers: PulseReader[]; alerts: PulseAlert[]; next: string };

/** "Later" on a notification mutes that deal for this long. */
export const SNOOZE_MS = 2 * 60 * 60 * 1000;
/** Alert ids remembered so a replayed one never pops twice. */
const SEEN_MAX = 100;

/** Prospects reading right now, as the toolbar badge shows them. */
export function badgeText(readers: PulseReader[]) {
  const deals = new Set(readers.map((reader) => reader.linkId)).size;
  if (deals === 0) return "";
  return deals > 9 ? "9+" : String(deals);
}

/**
 * Alerts to show now: not seen before, not about a deal the seller put off,
 * and not call moments when the seller switched those off in the popup.
 * Prospect actions (validated, change request) always go through.
 */
export function alertsToShow(
  alerts: PulseAlert[],
  state: { seen: string[]; snoozed: Record<string, number>; callMoments: boolean },
  now: number,
) {
  return alerts.filter((alert) => {
    if (state.seen.includes(alert.id)) return false;
    if (alert.priority === "ACTION") return true;
    if (!state.callMoments) return false;
    return !((state.snoozed[alert.linkId] ?? 0) > now);
  });
}

export function rememberSeen(seen: string[], ids: string[]) {
  return [...seen, ...ids].slice(-SEEN_MAX);
}

export function pruneSnoozes(snoozed: Record<string, number>, now: number) {
  return Object.fromEntries(Object.entries(snoozed).filter(([, until]) => until > now));
}

/** Popup line for one reader: "Acme · Léa, page 4". */
export function readerLine(reader: PulseReader) {
  const who = reader.name && reader.name !== reader.label ? `${reader.label} · ${reader.name}` : reader.label;
  return reader.currentPage ? `${who}, page ${reader.currentPage}` : who;
}

// In-page banners in Gmail / Outlook: they work even when the OS blocks
// Chrome's notifications. The background keeps the recent alerts in
// storage.local; every mail tab renders them and hides the dismissed ones.

export const MAIL_ALERTS_KEY = "mailAlerts";
export const MAIL_DISMISSED_KEY = "mailDismissed";

/** A call moment is stale after this; a prospect action stays until closed. */
const CALL_BANNER_MS = 5 * 60 * 1000;
const ACTION_BANNER_MS = 24 * 60 * 60 * 1000;
const BANNERS_MAX = 3;

export type MailAlert = PulseAlert & { shownAt: number };

export function keepMailAlerts(current: MailAlert[], added: PulseAlert[], now: number) {
  const fresh = current.filter((alert) => now - alert.shownAt < ACTION_BANNER_MS);
  return [...fresh, ...added.map((alert) => ({ ...alert, shownAt: now }))].slice(-10);
}

/** Newest first, at most three, without the dismissed and the stale ones. */
export function bannersToShow(alerts: MailAlert[], dismissed: string[], now: number) {
  return alerts
    .filter((alert) => !dismissed.includes(alert.id))
    .filter((alert) => now - alert.shownAt < (alert.priority === "ACTION" ? ACTION_BANNER_MS : CALL_BANNER_MS))
    .reverse()
    .slice(0, BANNERS_MAX);
}
