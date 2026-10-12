/** Longest question a user can type. */
export const HELP_MESSAGE_MAX = 1000;
/** Past messages (both roles) sent back to the model with each question. */
export const HELP_HISTORY_MAX = 12;
/** A conversation is the last day of messages: the next morning starts a fresh one. */
export const HELP_HISTORY_WINDOW_MS = 24 * 60 * 60 * 1000;

/** Questions per user per hour, then per day. */
export const HELP_USER_HOURLY_MAX = 30;
export const HELP_USER_DAILY_MAX = 100;

/** Messages sent to the team per user per day, so one loop cannot flood the inbox. */
export const HELP_FEEDBACK_DAILY_MAX = 10;
