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
export const TRACKING_FLUSH_INTERVAL_MS = 10_000;
export const LIVE_VIEW_WINDOW_MS = 2 * 60 * 1000;

// Reading time stops counting after this long without scroll, mouse or key
export const IDLE_TIMEOUT_MS = 2 * 60 * 1000;

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

export const SUPPORTED_LOCALES = ["en", "fr", "es", "de", "it", "pt"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: SupportedLocale = "en";
