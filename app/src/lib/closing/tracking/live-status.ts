import { LIVE_READING_WINDOW_MS } from "../constants";

/** A view is live while flushes keep coming and the tab was not left. */
export function isReadingNow(view: { lastSeenAt: Date; leftAt: Date | null }, now: Date) {
  return !view.leftAt && now.getTime() - view.lastSeenAt.getTime() <= LIVE_READING_WINDOW_MS;
}
