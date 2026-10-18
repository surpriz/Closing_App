/**
 * How far a seller got towards a first reading, the one moment that shows what Clozer does.
 * Each screen shows what serves the current stage and keeps the rest for later.
 */
export type SellerStage =
  /** Nothing dropped yet. */
  | "empty"
  /** A document, no link copied or sent yet. */
  | "unsent"
  /** A link went out (copied or confirmed sent), nobody opened one yet. */
  | "waiting"
  /** At least one prospect opened a link. */
  | "reading";

export type SellerProgress = { documents: number; sent: number; read: number };

export function sellerStage({ documents, sent, read }: SellerProgress): SellerStage {
  if (read > 0) return "reading";
  if (sent > 0) return "waiting";
  if (documents > 0) return "unsent";
  return "empty";
}
