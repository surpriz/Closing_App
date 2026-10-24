import { z } from "zod";

import { bareSlug } from "@/lib/closing/link-url";
import { isProspectSide } from "@/lib/closing/replies/inbound";
import { recordProspectReply } from "@/lib/closing/replies/record";
import { prisma } from "@/lib/db";
import { extError, withExtensionAuth } from "@/lib/extension-auth";

const schema = z.object({
  replies: z
    .array(
      z.object({
        slug: z.string().min(1).max(64),
        fromEmail: z.email().max(254),
        fromName: z.string().max(200).nullish(),
        // The mail app's id of the reply, so a thread opened again logs nothing new
        messageKey: z.string().min(1).max(200),
      }),
    )
    .max(20),
});

/**
 * The extension saw, in a thread of the seller's Gmail, a message from the prospect's side after
 * the one carrying a Clozer link. Only addresses of the deal's contacts, or of their company,
 * count: a colleague in copy or a newsletter in the same thread must not stop the follow-ups.
 */
export const POST = withExtensionAuth(async (request, { user, organization }) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return extError(400, "invalid");

  const team = await prisma.member.findMany({
    where: { organizationId: organization.id },
    select: { user: { select: { email: true } } },
  });
  const teamEmails = [user.email, ...team.map((m) => m.user.email)];

  let logged = 0;
  for (const reply of parsed.data.replies) {
    const fromEmail = reply.fromEmail.toLowerCase();
    // Read from the email's href: the words of the address may come with it
    const slug = bareSlug(reply.slug);
    if (!slug) continue;
    const link = await prisma.link.findFirst({
      where: { slug, organizationId: organization.id, archivedAt: null, shared: false },
      select: { id: true, prospects: { select: { id: true, email: true } } },
    });
    if (!link) continue;
    if (!isProspectSide(fromEmail, link.prospects.map((p) => p.email), teamEmails)) continue;
    const prospect = link.prospects.find((p) => p.email.toLowerCase() === fromEmail);

    const done = await recordProspectReply({
      linkId: link.id,
      prospectId: prospect?.id ?? null,
      followupId: null,
      fromEmail,
      fromName: reply.fromName ?? null,
      // The extension sends who answered, not what: the seller has the email in front of them
      excerpt: null,
      occurredAt: new Date(),
      source: "EXTENSION",
      externalKey: `ext:${link.id}:${reply.messageKey}`,
    });
    if (done) logged++;
  }
  return Response.json({ logged });
});
