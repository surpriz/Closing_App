import type { AppPathname } from "@/i18n/routing";

// Shown as "Mise à jour le …" on the legal pages and used as lastModified in the sitemap.
// The home date is the last copy change.
export const UPDATED_AT: Record<AppPathname, Date> = {
  "/": new Date("2026-10-12"),
  "/terms": new Date("2026-10-16"),
  "/privacy": new Date("2026-10-13"),
  "/legal": new Date("2026-10-16"),
  "/subprocessors": new Date("2026-10-11"),
  "/support": new Date("2026-10-13"),
};
