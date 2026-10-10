import { DAY_MS } from "../constants";

/**
 * What the prospect will meet on a link, in a few words: the share screen's
 * chips and the line the extensions show after inserting a link. Pure.
 */
export function settingsSummary(
  link: {
    shared: boolean;
    requireEmail: boolean;
    expiresAt: Date | null;
    ctaEnabled: boolean;
    chatEnabled: boolean;
    followupsEnabled: boolean;
  },
  now: Date,
) {
  const days = link.expiresAt ? Math.max(0, Math.ceil((link.expiresAt.getTime() - now.getTime()) / DAY_MS)) : null;
  return [
    link.shared ? "Un lien par lecteur" : link.requireEmail ? "Email demandé" : "Ouverture libre",
    days === null ? "Sans expiration" : `Expire dans ${days} j`,
    link.ctaEnabled ? "Validation en ligne" : null,
    link.chatEnabled ? "Assistant IA" : null,
    link.followupsEnabled ? (link.shared ? "Relances à valider" : "Relances auto") : "Sans relance",
  ].filter((item): item is string => !!item);
}
