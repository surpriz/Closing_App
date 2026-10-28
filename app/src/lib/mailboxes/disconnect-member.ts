import { prisma } from "@/lib/db";

import { disconnectMailbox } from "./connect";

/**
 * Disconnects the mailboxes a removed member connected in this workspace: each one goes through
 * `disconnectMailbox`, so the provider grant is revoked (best effort) and the stored credentials are wiped.
 */
export async function disconnectMemberMailboxes(organizationId: string, userId: string) {
  const mailboxes = await prisma.mailbox.findMany({
    where: { organizationId, userId, status: { not: "DISCONNECTED" } },
    select: { id: true },
  });
  let count = 0;
  for (const { id } of mailboxes) {
    if (await disconnectMailbox(organizationId, userId, id)) count++;
  }
  return { count };
}
