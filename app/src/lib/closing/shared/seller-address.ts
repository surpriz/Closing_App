import { prisma } from "@/lib/db";

const GMAIL = ["gmail.com", "googlemail.com"];

/**
 * The mailbox an address lands in: "+tag" dropped, case ignored, and for
 * Gmail the dots and googlemail.com too ("Jean.D+t7@googlemail.com" is
 * jeand@gmail.com). Pure.
 */
export function mailboxOf(email: string) {
  const [rawLocal = "", rawDomain = ""] = email.trim().toLowerCase().split("@");
  const local = rawLocal.split("+")[0];
  return GMAIL.includes(rawDomain) ? `${local.replaceAll(".", "")}@gmail.com` : `${local}@${rawDomain}`;
}

/** A plus-tagged copy of the seller's address for a test: recognised as theirs, lands in their inbox. Pure. */
export function testAddress(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  return `${local.split("+")[0]}+test@${domain}`;
}

/**
 * The seller testing their own link: an address of one of the workspace's
 * members, plus-tags and Gmail aliases included. Such a reader is a test.
 * The database narrows on the domain, the few left are compared here.
 */
export async function isWorkspaceAddress(organizationId: string, email: string) {
  const mailbox = mailboxOf(email);
  const domain = mailbox.split("@")[1] ?? "";
  const members = await prisma.member.findMany({
    where: {
      organizationId,
      user: {
        OR: (GMAIL.includes(domain) ? GMAIL : [domain]).map((d) => ({
          email: { endsWith: `@${d}`, mode: "insensitive" as const },
        })),
      },
    },
    select: { user: { select: { email: true } } },
  });
  return members.some((member) => mailboxOf(member.user.email) === mailbox);
}
