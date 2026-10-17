import { HOUR_MS } from "../constants";

// "Transférer" makes Clozer's sender email any address a reader types:
// enough room for a real buying team, nothing for a spammer.

/** The same address on the same link: a double click or an impatient reader, answered "sent" without a second email. */
export const FORWARD_RECIPIENT_COOLDOWN_MS = HOUR_MS;
/** Per link, per browser, per UTC day. */
export const FORWARD_VISITOR_DAILY_MAX = 5;
/** Across links: a script cycling cookies still shares a network. */
export const FORWARD_IP_HOURLY_MAX = 10;
/** A buying team forwards a handful of times, not dozens. */
export const FORWARD_LINK_DAILY_MAX = 20;
/** One customer's proposals cannot turn the sender into a mailing list. */
export const FORWARD_WORKSPACE_DAILY_MAX = 200;
/** Past this many forward alerts in an hour on one link, the next ones are stored without a push. */
export const FORWARD_ALERTS_PER_LINK_HOUR = 5;
export const FORWARD_MESSAGE_MAX = 1000;
