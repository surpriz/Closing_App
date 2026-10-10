import { expiryInDays, showsCountdown } from "../expiry";

/**
 * What a new link looks like when the seller sets nothing. Pure.
 * The workspace says what it wants in general; the document type adjusts it:
 * a quote gets a deadline and the "Valider" button, a brochure gets neither.
 * Before the AI has read the document the type is unknown, and the link keeps
 * the workspace values until it is.
 */

export type WorkspaceLinkDefaults = {
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
  expiresAt: Date | null;
};

/** Documents a prospect can say yes to. */
const AGREEABLE_DOC_TYPES = ["QUOTE", "PROPOSAL", "CONTRACT"];

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
  { allowShared = true }: { allowShared?: boolean } = {},
): LinkDefaults {
  const known = !!docType;
  const deadline = known && showsCountdown(docType) && workspace.quoteExpiryDays;
  const shared = allowShared && known && SHARED_DOC_TYPES.includes(docType);
  return {
    shared: false,
    requireEmail: workspace.requireEmailByDefault,
    chatEnabled: workspace.chatEnabledByDefault,
    voiceCommentsEnabled: workspace.voiceCommentsByDefault,
    followupsEnabled: workspace.followupsByDefault,
    ctaEnabled: !known || AGREEABLE_DOC_TYPES.includes(docType),
    expiresAt: deadline ? expiryInDays(deadline, now, timeZone) : null,
    ...(shared && SHARED_LINK_SETTINGS),
  };
}
