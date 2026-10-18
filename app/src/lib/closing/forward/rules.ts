import type { ProspectOrigin } from "@/generated/prisma/enums";

/**
 * Who can forward a link and to whom. Pure.
 *
 * A shared link already gives each reader their own link, and an onboarding
 * test is the seller looking at their own page: neither forwards. The seller
 * can also turn it off on a confidential document.
 */
export function canForward(link: { shared: boolean; isOnboardingTest: boolean; forwardEnabled: boolean }) {
  return link.forwardEnabled && !link.shared && !link.isOnboardingTest;
}

export type RecipientRefusal = "self" | "seller" | "unavailable";

export function decideRecipient(input: {
  fromEmail: string;
  toEmail: string;
  recipientIsMember: boolean;
  recipientOptedOut: boolean;
}): RecipientRefusal | null {
  if (input.fromEmail.trim().toLowerCase() === input.toEmail.trim().toLowerCase()) return "self";
  // The seller's team already has the document: forwarding there is a mistake, not a lead
  if (input.recipientIsMember) return "seller";
  // Said stop to this workspace: no email from it, whoever asks
  if (input.recipientOptedOut) return "unavailable";
  return null;
}

// A personal note, not a vehicle for links: the email goes out under Clozer's name
const LINK = /https?:\/\/|www\.|\b[a-z0-9-]{2,}\.(?:com|net|org|io|co|ly|me|info|biz|xyz|app|dev|link|site|online|shop|top|fr|ru|cn)\b/i;

export function containsLink(text: string) {
  return LINK.test(text);
}

/**
 * The forwardedById to write on the recipient's contact, or null to leave it.
 * The tree keeps how each person first arrived: a contact the seller added
 * never moves under a reader, an edge is never rewritten, and a forward back
 * up the chain ("je te remets dans la boucle") never makes a loop.
 * `parentOf` holds the link's current edges.
 */
export function forwardTreeParent(
  recipient: { id: string; origin: ProspectOrigin; forwardedById: string | null },
  fromProspectId: string | null,
  parentOf: Map<string, string | null>,
): string | null {
  if (!fromProspectId || recipient.id === fromProspectId) return null;
  if (recipient.origin === "SELLER" || recipient.forwardedById) return null;
  const seen = new Set<string>();
  for (let id: string | null | undefined = fromProspectId; id && !seen.has(id); id = parentOf.get(id)) {
    if (id === recipient.id) return null;
    seen.add(id);
  }
  return fromProspectId;
}
