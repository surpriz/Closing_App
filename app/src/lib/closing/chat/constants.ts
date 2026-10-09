/** Longest question a prospect can type. */
export const CHAT_MESSAGE_MAX = 1000;
/** Past messages (both roles) sent back to the model with each question. */
export const CHAT_HISTORY_MAX = 12;

/** Questions per browser session per hour, then per browser per day. */
export const CHAT_VIEW_HOURLY_MAX = 20;
export const CHAT_VISITOR_DAILY_MAX = 60;
/** Questions per network per hour: a new cookie per question must not reset the limits. */
export const CHAT_IP_HOURLY_MAX = 40;

/** Document context given to the model, in characters (~12k tokens). */
export const CHAT_CONTEXT_CHARS = 48_000;
/** Full text kept per page, so one long annex cannot eat the whole budget. */
export const CHAT_PAGE_TEXT_MAX = 6_000;

/** Questions forwarded to the seller per link per hour, beyond that the deal page is enough. */
export const CHAT_ESCALATIONS_PER_LINK_HOUR = 3;
