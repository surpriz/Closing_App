import { getSellerPrefs } from "@/lib/closing/notify/preferences";
import { guessMailClient } from "@/lib/closing/share/compose";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { extensionProbe } from "@/lib/extension-config";
import { isExtensionNudgeSnoozed, parseMailClient, toolFor } from "@/lib/onboarding";

import { ExtensionBanner } from "./extension-banner";

/** The extension banner, for sellers whose mailbox it works with and who haven't closed it lately. */
export async function DashboardExtensionBanner({
  user,
  organizationId,
}: {
  user: { id: string; email: string };
  organizationId: string;
}) {
  const storeUrl = getEnv().EXTENSION_STORE_URL;
  if (!storeUrl) return null;
  const prefs = await getSellerPrefs(user.id, organizationId);
  if (isExtensionNudgeSnoozed(prefs.extensionNudgeHiddenAt, new Date())) return null;
  // Unknown mailbox counts: most sellers on Chrome write from Gmail or Outlook on the web
  const client = parseMailClient(prefs.mailClient ?? guessMailClient(user.email));
  if (client && toolFor(client) !== "chrome") return null;

  const tokens = await prisma.extensionToken.findMany({
    where: { userId: user.id, organizationId, revokedAt: null },
    select: { label: true },
  });
  return <ExtensionBanner probe={extensionProbe(user.email, tokens)} storeUrl={storeUrl} />;
}
