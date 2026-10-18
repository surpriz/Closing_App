import { getSellerProgress, type SellerScope } from "@/lib/closing/dashboard/queries";
import { sellerStage } from "@/lib/closing/dashboard/seller-stage";
import type { StoredPrefs } from "@/lib/closing/notify/preferences";
import { guessMailClient } from "@/lib/closing/share/compose";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { extensionProbe } from "@/lib/extension-config";
import { connectedClients } from "@/lib/extension-tokens";
import { mailToolTip, parseMailClient } from "@/lib/onboarding";

import { ChromeMailToolTip } from "./chrome-mail-tool-tip";
import { MailToolTip } from "./mail-tool-tip";

/**
 * Picks the tip for the share screen from the seller's mailbox and paired tools.
 * Not before a first link went out: the first one is copied by hand, that is the point.
 */
export async function ShareMailToolTip({
  user,
  organizationId,
  scope,
  prefs,
  returnTo,
}: {
  user: { id: string; email: string };
  organizationId: string;
  scope: SellerScope;
  prefs: Pick<StoredPrefs, "mailClient" | "mailToolTipHiddenAt">;
  /** The share screen it sits under, for the setup step's way back. */
  returnTo: string;
}) {
  if (prefs.mailToolTipHiddenAt) return null;
  const [progress, tokens] = await Promise.all([
    getSellerProgress(organizationId, scope),
    prisma.extensionToken.findMany({
      where: { userId: user.id, organizationId, revokedAt: null },
      select: { label: true },
    }),
  ]);
  const stage = sellerStage(progress);
  if (stage === "empty" || stage === "unsent") return null;
  const client = parseMailClient(prefs.mailClient ?? guessMailClient(user.email));
  const tool = mailToolTip(client, connectedClients(tokens));
  // Not on the Chrome Web Store yet: nothing to install
  if (!tool || (tool === "chrome" && !getEnv().EXTENSION_STORE_URL)) return null;
  const mailbox = client === "gmail" ? "Gmail" : "Outlook";
  if (tool === "chrome") {
    return <ChromeMailToolTip probe={extensionProbe(user.email, tokens)} mailbox={mailbox} returnTo={returnTo} />;
  }
  return <MailToolTip tool={tool} mailbox={mailbox} returnTo={returnTo} />;
}
