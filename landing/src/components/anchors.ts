import type { Locale } from "@/i18n/routing";

type Section = "how" | "features" | "followUps" | "campaigns" | "prospect" | "pricing" | "faq";

/** Section ids on the home page, in the reader's language: the header links to them and people share them. */
export const ANCHORS: Record<Locale, Record<Section, string>> = {
  fr: {
    how: "comment",
    features: "fonctionnalites",
    followUps: "relances",
    campaigns: "campagnes",
    prospect: "prospect",
    pricing: "tarifs",
    faq: "questions",
  },
  en: {
    how: "how-it-works",
    features: "features",
    followUps: "follow-ups",
    campaigns: "campaigns",
    prospect: "prospect-side",
    pricing: "pricing",
    faq: "faq",
  },
};

/**
 * Ids the page used before, kept so links already shared still land. Sections that were folded into
 * another one (channels into the steps, video and team into features, segments into pricing) point there.
 */
export const LEGACY_ANCHORS: Record<Locale, Partial<Record<Section, string[]>>> = {
  fr: { how: ["envoi"], features: ["video"], pricing: ["equipes", "pour-qui"], faq: ["faq"] },
  en: { how: ["comment", "channels", "envoi"], features: ["video-pitch"], followUps: ["relances"], pricing: ["teams", "pour-qui"] },
};
