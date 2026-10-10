/** Longest clip, cut by the recorder and checked again by the server. */
export const CAPSULE_MAX_MS = 30_000;
export const VOICE_COMMENT_MAX_MS = 60_000;

/** Recorder bitrates: ~4 MB for a 30 s video, ~0.5 MB for a 60 s voice comment. */
export const VIDEO_BITS_PER_SECOND = 1_000_000;
export const AUDIO_BITS_PER_SECOND = 64_000;

/** Upload ceilings, with room above the bitrates (browsers overshoot). */
export const CAPSULE_VIDEO_MAX_BYTES = 12 * 1024 * 1024;
export const CAPSULE_AUDIO_MAX_BYTES = 2 * 1024 * 1024;
export const VOICE_COMMENT_MAX_BYTES = 1.5 * 1024 * 1024;

/** "Sur cette partie, laisse-moi t'expliquer…" shown next to the bubble. */
export const CAPSULE_HOOK_MAX = 120;

/** Voice comments per browser session per hour, per browser per day, per network per hour. */
export const VOICE_VIEW_HOURLY_MAX = 5;
export const VOICE_VISITOR_DAILY_MAX = 15;
export const VOICE_IP_HOURLY_MAX = 10;
/** Voice comments alerted per link per hour, beyond that the deal page is enough. */
export const VOICE_ALERTS_PER_LINK_HOUR = 6;
