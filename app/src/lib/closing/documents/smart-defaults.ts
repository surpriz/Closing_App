import type { DocumentKind } from "@/generated/prisma/enums";

import { expiryInDays, showsCountdown } from "../expiry";

/**
 * What a new link looks like when the seller sets nothing. Pure.
 * The workspace says what it wants in general; the document type adjusts it:
 * a quote gets a deadline and the "Valider" button, a brochure gets neither,
 * an invoice no "Prendre rendez-vous".
 * Before the AI has read the document the type is unknown, and the link keeps
 * the workspace values until it is.
 * A video pitch is personal whatever its transcript sounds like: no shared
 * link, no deadline, a "Demander un devis" button (ctaEnabled) and a meeting.
 * A personal link never asks for the email: it was made for one person, who
 * should read straight away. A forwarded copy is still spotted as a new reader.
 */

export type WorkspaceLinkDefaults = {
  /** Kept for older settings; personal links no longer ask for the email. */
  requireEmailByDefault: boolean;
  chatEnabledByDefault: boolean;
  voiceCommentsByDefault: boolean;
  followupsByDefault: boolean;
  quoteExpiryDays: number | null;
};

export type LinkDefaults = {
  shared: boolean;
  requireEmail: boolean;
  chatEnabled: boolean;
  voiceCommentsEnabled: boolean;
  followupsEnabled: boolean;
  ctaEnabled: boolean;
  bookingEnabled: boolean;
  expiresAt: Date | null;
};

/** Documents a prospect can say yes to. */
const AGREEABLE_DOC_TYPES = ["QUOTE", "PROPOSAL", "CONTRACT"];

/** "Valider & signer" and "Demander un ajustement" only make sense on a deal. Unknown type: offered. */
function offersAnswers(docType: string | null | undefined) {
  return !docType || AGREEABLE_DOC_TYPES.includes(docType);
}

/** Documents that call for no meeting: the deal is already done. */
const NO_MEETING_DOC_TYPES = ["INVOICE"];

/** Documents made to circulate: one shared link, each reader their own deal. */
const SHARED_DOC_TYPES = ["PRESENTATION", "BROCHURE", "CASE_STUDY"];

/**
 * A shared link always asks for the email: that is how each reader gets
 * their own link. Its other settings are the template every reader's link
 * starts from.
 */
export const SHARED_LINK_SETTINGS = { shared: true, requireEmail: true } as const;

export function linkDefaultsFor(
  docType: string | null | undefined,
  workspace: WorkspaceLinkDefaults,
  now: Date,
  timeZone: string,
  /** False once the link is for someone in particular: a named prospect, an email from the extension. */
  { allowShared = true, kind }: { allowShared?: boolean; kind?: DocumentKind } = {},
): LinkDefaults {
  if (kind === "VIDEO") {
    return {
      shared: false,
      requireEmail: false,
      chatEnabled: workspace.chatEnabledByDefault,
      voiceCommentsEnabled: false,
      followupsEnabled: workspace.followupsByDefault,
      ctaEnabled: true,
      bookingEnabled: true,
      expiresAt: null,
    };
  }
  const known = !!docType;
  const deadline = known && showsCountdown(docType) && workspace.quoteExpiryDays;
  const shared = allowShared && known && SHARED_DOC_TYPES.includes(docType);
  return {
    shared: false,
    requireEmail: false,
    chatEnabled: workspace.chatEnabledByDefault,
    voiceCommentsEnabled: workspace.voiceCommentsByDefault,
    followupsEnabled: workspace.followupsByDefault,
    ctaEnabled: offersAnswers(docType),
    bookingEnabled: !known || !NO_MEETING_DOC_TYPES.includes(docType),
    expiresAt: deadline ? expiryInDays(deadline, now, timeZone) : null,
    ...(shared && SHARED_LINK_SETTINGS),
  };
}
