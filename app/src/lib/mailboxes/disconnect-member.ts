import { prisma } from "@/lib/db";

/** Disconnects the mailboxes a removed member connected in this workspace and wipes their stored credentials. */
export async function disconnectMemberMailboxes(organizationId: string, userId: string) {
  return prisma.mailbox.updateMany({
    where: { organizationId, userId, status: { not: "DISCONNECTED" } },
    data: { status: "DISCONNECTED", disconnectedAt: new Date(), credentials: "" },
  });
}
