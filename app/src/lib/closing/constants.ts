// Keep in sync with the @default values of WorkspaceSettings in prisma/schema.prisma
export const WORKSPACE_DEFAULTS = {
  hotPricingThresholdSec: 90,
  inactivityDays: [3, 5],
  businessHourStart: 9,
  businessHourEnd: 18,
  businessDays: [1, 2, 3, 4, 5],
  multiViewerThreshold: 2,
  reopenAfterInactivityDays: 3,
} as const;

// The viewer flushes tracking every ~10s. A view is "live" if it pinged
// within this window, which also tolerates short tab switches.
export const DAY_MS = 24 * 60 * 60 * 1000;

export const TRACKING_FLUSH_INTERVAL_MS = 10_000;
export const LIVE_VIEW_WINDOW_MS = 2 * 60 * 1000;
// A reader counts as "reading now" if a flush arrived this recently
export const LIVE_READING_WINDOW_MS = 2 * TRACKING_FLUSH_INTERVAL_MS + 5_000;

// Reading time stops counting after this long without scroll, mouse or key
export const IDLE_TIMEOUT_MS = 2 * 60 * 1000;
// Same for URL documents, where activity inside the iframe is invisible to us
// (a Loom video, a long Notion page scrolled under the mouse)
export const EMBED_IDLE_TIMEOUT_MS = 10 * 60 * 1000;

// Reopening the link within this window continues the same view
export const VIEW_SESSION_WINDOW_MS = 30 * 60 * 1000;

// Ignore absurd durations from a single flush (sleeping laptop, stuck tab)
export const MAX_PAGE_DURATION_PER_FLUSH_MS = 60_000;
export const MAX_TRACKING_EVENTS_PER_BATCH = 50;

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const ENGAGEMENT_TIER_THRESHOLDS = {
  HOT: 70,
  WARM: 35,
} as const;

/**
 * Hot, at risk or dead on the team page. In days, except the AI priority
 * (1 to 5) from which a deal counts as hot.
 */
export const TEAM_HEALTH = {
  /** Sent, never opened since: nobody is coming. */
  neverOpenedDeadDays: 14,
  /** Opened once, then no reading since. */
  silentDeadDays: 21,
  /** Opened, then quiet this long: slipping. */
  quietRiskDays: 7,
  /** Sent, still not opened. */
  unopenedRiskDays: 5,
  /** A long pricing read stays a hot sign this long. */
  pricingHotDays: 7,
  aiHotPriority: 4,
} as const;

export const SUPPORTED_LOCALES = ["en", "fr", "es", "de", "it", "pt"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";

/**
 * "Lu en profondeur" on the dashboard funnel. A PDF counts once half of it was
 * reached with some real reading time (maxPageReached alone is a scroll, not a
 * read). Web documents have no pages, and their time runs on a 10 min idle
 * timeout, hence a higher bar.
 */
export const DEEP_READ = {
  pdfCompletion: 0.5,
  pdfMinMs: 30_000,
  webMinMs: 60_000,
} as const;
