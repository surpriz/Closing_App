import type { StoredPrefs } from "@/lib/closing/notify/preferences";
import { guessMailClient } from "@/lib/closing/share/compose";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { connectedClients } from "@/lib/extension-tokens";
import { mailToolTip, parseMailClient } from "@/lib/onboarding";

import { MailToolTip } from "./mail-tool-tip";

/** Picks the tip for the share screen from the seller's mailbox and paired tools. */
export async function ShareMailToolTip({
  user,
  organizationId,
  prefs,
}: {
  user: { id: string; email: string };
  organizationId: string;
  prefs: Pick<StoredPrefs, "mailClient" | "mailToolTipHiddenAt">;
}) {
  if (prefs.mailToolTipHiddenAt) return null;
  const tokens = await prisma.extensionToken.findMany({
    where: { userId: user.id, organizationId, revokedAt: null },
    select: { label: true },
  });
  const client = parseMailClient(prefs.mailClient ?? guessMailClient(user.email));
  const tool = mailToolTip(client, connectedClients(tokens));
  // Not on the Chrome Web Store yet: nothing to install
  if (!tool || (tool === "chrome" && !getEnv().EXTENSION_STORE_URL)) return null;
  return <MailToolTip tool={tool} mailbox={client === "gmail" ? "Gmail" : "Outlook"} />;
}
