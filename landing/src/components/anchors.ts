import type { Locale } from "@/i18n/routing";

type Section = "how" | "features" | "video" | "followUps" | "prospect" | "channels" | "teams" | "faq";

/** Section ids on the home page, in the reader's language: the header links to them and people share them. */
export const ANCHORS: Record<Locale, Record<Section, string>> = {
  fr: {
    how: "comment",
    features: "fonctionnalites",
    video: "video",
    followUps: "relances",
    prospect: "prospect",
    channels: "envoi",
    teams: "equipes",
    faq: "questions",
  },
  en: {
    how: "how-it-works",
    features: "features",
    video: "video-pitch",
    followUps: "follow-ups",
    prospect: "prospect-side",
    channels: "channels",
    teams: "teams",
    faq: "faq",
  },
};

/** Ids the page used before they were translated, kept so links already shared still land on their section. */
export const LEGACY_ANCHORS: Record<Locale, Partial<Record<Section, string>>> = {
  fr: { teams: "pour-qui", faq: "faq" },
  en: { how: "comment", followUps: "relances", channels: "envoi", teams: "pour-qui" },
};
