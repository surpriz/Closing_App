import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";

import { createForwardToken, forwardIdOf, verifyForwardToken } from "./token";

// ENCRYPTION_KEY never rotates, so forward emails already sent keep working
function forwardSecret() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) {
    throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  }
  return secret;
}

/** The link in the forward email: the viewer, with a token that names the recipient. */
export function forwardUrl(slug: string, forwardId: string, toEmail: string) {
  return `${getPublicAppUrl()}/v/${slug}?f=${encodeURIComponent(createForwardToken(forwardId, toEmail, forwardSecret()))}`;
}

/** The recipient a forward token names on this link, or null when it was tampered with or belongs elsewhere. */
export async function forwardRecipient(linkId: string, token: string) {
  const id = forwardIdOf(token);
  if (!id) return null;
  const forward = await prisma.linkForward.findUnique({
    where: { id },
    select: { linkId: true, toProspect: { select: { email: true, name: true } } },
  });
  if (!forward || forward.linkId !== linkId) return null;
  return verifyForwardToken(token, forward.toProspect.email, forwardSecret()) ? forward.toProspect : null;
}
