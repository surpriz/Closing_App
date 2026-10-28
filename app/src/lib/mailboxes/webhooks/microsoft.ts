import { prisma } from "@/lib/db";

import { verifyClientState } from "./token";

/** Graph sends at most a few dozen per call; anything beyond this is not read. */
const MAX_NOTIFICATIONS = 100;

/** The validation token is echoed back as text: keep it printable and bounded. */
export function microsoftValidationToken(value: string | null): string | null {
  return value && value.length <= 1000 && /^[\x20-\x7e]+$/.test(value) ? value : null;
}

type Notification = { subscriptionId?: unknown; clientState?: unknown; lifecycleEvent?: unknown };

/**
 * Graph notifications carry no usable content: each one only says which mailbox to look at. A notification whose
 * clientState does not match the mailbox it names is dropped without any write. Returns the mailboxes to sync.
 */
export async function handleMicrosoftNotifications(
  payload: unknown,
  now = new Date(),
): Promise<{ syncMailboxIds: string[] }> {
  const value = (payload as { value?: unknown } | null)?.value;
  if (!Array.isArray(value)) return { syncMailboxIds: [] };

  const sync = new Set<string>();
  for (const item of value.slice(0, MAX_NOTIFICATIONS) as Notification[]) {
    const subscriptionId = typeof item?.subscriptionId === "string" ? item.subscriptionId : null;
    const clientState = typeof item?.clientState === "string" ? item.clientState : null;
    if (!subscriptionId || !clientState) continue;

    try {
      const mailbox = await prisma.mailbox.findFirst({
        where: { connector: "GRAPH", subscriptionId, status: "ACTIVE" },
        select: { id: true },
      });
      if (!mailbox || !verifyClientState(mailbox.id, clientState)) continue;

      const lifecycle = typeof item.lifecycleEvent === "string" ? item.lifecycleEvent : null;
      if (lifecycle === "reauthorizationRequired" || lifecycle === "subscriptionRemoved") {
        // The next tick renews, or recreates the subscription when Graph says it is gone
        await prisma.mailbox.updateMany({ where: { id: mailbox.id }, data: { subscriptionExpiresAt: null } });
        continue;
      }
      await prisma.mailbox.updateMany({ where: { id: mailbox.id }, data: { syncRequestedAt: now } });
      if (lifecycle !== "missed") sync.add(mailbox.id);
    } catch (error) {
      // One bad notification must not drop the rest of the batch
      console.error("[mailboxes] microsoft notification failed", error instanceof Error ? error.message : "unknown");
    }
  }
  return { syncMailboxIds: [...sync] };
}
