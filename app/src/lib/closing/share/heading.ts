export type ShareHeading = "liveShared" | "sentPersonal" | "openedNoRecipient" | "linkCopied" | "ready";

/**
 * What the share screen's title says, from what really happened: a Smart Link is live once sent;
 * a personal link someone opened before the seller named a recipient asks who it is for; otherwise
 * sent, copied, or simply ready.
 */
export function shareHeading(s: {
  sent: boolean;
  shared: boolean;
  wasCopied: boolean;
  opened: boolean;
  hasRecipient: boolean;
}): ShareHeading {
  if (s.sent && s.shared) return "liveShared";
  // A prospect's first view does not mark a personal link sent: the opening itself is the news
  if (s.opened && !s.shared && !s.hasRecipient) return "openedNoRecipient";
  if (s.sent) return "sentPersonal";
  if (s.wasCopied) return "linkCopied";
  return "ready";
}
