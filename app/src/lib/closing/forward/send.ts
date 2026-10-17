import { getPublicAppUrl } from "@/lib/app-origin";
import { prisma } from "@/lib/db";
import { isEmailConfigured } from "@/lib/email";
import { senderAs } from "@/lib/email-address";

import { forwardEmail, forwardReceiptEmail, forwardSenderName } from "../i18n/forward-email";
import { prospectSender, sendProspectEmail } from "../prospect-email";
import { viewerSenderName } from "../sender-name";
import { forwardUrl } from "./index";
import { readerName } from "./names";
import { isOptedOutInWorkspace } from "./queries";

/** The forward email itself. Records whether it left, and throws when it did not. */
export async function sendForwardEmail(forwardId: string) {
  const forward = await prisma.linkForward.findUniqueOrThrow({
    where: { id: forwardId },
    select: {
      message: true,
      locale: true,
      link: {
        select: {
          slug: true,
          document: { select: { name: true } },
          createdBy: { select: { name: true, email: true } },
          organization: { select: { name: true, settings: { select: { senderName: true } } } },
        },
      },
      fromProspect: { select: { name: true, email: true } },
      toProspect: { select: { id: true, name: true, email: true } },
    },
  });
  const { link, fromProspect, toProspect } = forward;
  const fromName = fromProspect ? readerName(fromProspect) : null;
  const from = prospectSender();
  try {
    if (!fromProspect || !fromName || !from) throw new Error("expéditeur inconnu");
    await sendProspectEmail({
      prospect: toProspect,
      locale: forward.locale,
      from: senderAs(forwardSenderName(fromName), from),
      // The recipient answers the colleague who sent it, not the seller
      replyTo: fromProspect.email,
      ...forwardEmail(forward.locale, {
        fromName,
        toName: toProspect.name,
        documentName: link.document.name,
        // The same name the recipient will see on the page
        senderName: viewerSenderName({
          senderName: link.organization.settings?.senderName,
          createdBy: link.createdBy,
          organizationName: link.organization.name,
        }),
        message: forward.message,
        url: forwardUrl(link.slug, forwardId, toProspect.email),
      }),
    });
    await prisma.linkForward.update({ where: { id: forwardId }, data: { sentAt: new Date(), error: null } });
  } catch (error) {
    await prisma.linkForward.update({
      where: { id: forwardId },
      data: { error: error instanceof Error ? error.message.slice(0, 500) : "échec" },
    });
    throw error;
  }
}

/**
 * "Me prévenir quand cette personne l'ouvre": once per forward, claimed before
 * sending so two sessions starting together never send it twice. Says it was
 * opened, nothing about how it was read.
 */
export async function sendForwardReceipt(forwardId: string) {
  if (!isEmailConfigured()) return;
  const claimed = await prisma.linkForward.updateMany({
    where: { id: forwardId, notifyOnOpen: true, receiptSentAt: null },
    data: { receiptSentAt: new Date() },
  });
  if (claimed.count === 0) return;

  const forward = await prisma.linkForward.findUniqueOrThrow({
    where: { id: forwardId },
    select: {
      locale: true,
      link: {
        select: {
          slug: true,
          organizationId: true,
          document: { select: { name: true } },
          createdBy: { select: { email: true } },
        },
      },
      fromProspect: { select: { id: true, email: true, locale: true, unsubscribedAt: true } },
      toProspect: { select: { name: true, email: true } },
    },
  });
  const { link, fromProspect } = forward;
  if (!fromProspect || fromProspect.unsubscribedAt) return;
  if (await isOptedOutInWorkspace(fromProspect.email, link.organizationId)) return;

  const locale = fromProspect.locale ?? forward.locale;
  await sendProspectEmail({
    prospect: fromProspect,
    locale,
    replyTo: link.createdBy?.email,
    ...forwardReceiptEmail(locale, {
      toName: readerName(forward.toProspect),
      documentName: link.document.name,
      url: `${getPublicAppUrl()}/v/${link.slug}`,
    }),
  });
}
