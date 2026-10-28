import { prisma } from "@/lib/db";

/** The mailbox an address lands in: "+tag" dropped, case ignored ("Jean+t7@Acme.fr" is jean@acme.fr). Pure. */
export function mailboxOf(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  return `${local.split("+")[0]}@${domain}`;
}

/** A plus-tagged copy of the seller's address for a test: recognised as theirs, lands in their inbox. Pure. */
export function testAddress(email: string) {
  const [local = "", domain = ""] = mailboxOf(email).split("@");
  return `${local}+test@${domain}`;
}

/**
 * The seller testing their own link: an address of one of the workspace's
 * members, plus-tags included. Such a reader is a test, never a prospect.
 */
export async function isWorkspaceAddress(organizationId: string, email: string) {
  const members = await prisma.member.findMany({
    where: { organizationId },
    select: { user: { select: { email: true } } },
  });
  const mailbox = mailboxOf(email);
  return members.some((member) => mailboxOf(member.user.email) === mailbox);
}
