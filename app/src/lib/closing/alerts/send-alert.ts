import type { AlertPriority, SellerAlertChannel, SellerAlertType } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { renderEmail, type EmailBlock } from "@/lib/email-layout";

import { postSignedWebhook, postSlackMessage } from "../channels/webhooks";
import { isUniqueViolation } from "../followups/queue";

export type AlertPayload = {
  liveViewers?: number;
  inactiveDays?: number;
  /** CALL_MOMENT: why now, written for the seller ("S'attarde sur les tarifs"). */
  reason?: string;
  detail?: string;
  /** Prospect actions */
  message?: string | null;
  prospectName?: string | null;
  prospectEmail?: string | null;
  viewId?: string;
};

export type AlertDelivery = {
  linkId: string;
  type: SellerAlertType;
  dedupeKey: string;
  payload: AlertPayload;
  channels: SellerAlertChannel[];
  priority: AlertPriority;
  /** Seller the alert is for. */
  userId: string | null;
  recipientEmail: string | null;
  /** WorkspaceSettings.alertEmail, copied on emails when it differs. */
  copyTo: string | null;
};

type LinkForAlert = {
  id: string;
  name: string | null;
  document: { id: string; name: string };
  prospects: { name: string | null; email: string; company: string | null }[];
};

type AlertMessage = {
  subject: string;
  /** One line for Slack and the feed of the extension. */
  line: string;
  blocks: EmailBlock[];
  url: string;
};

export function alertWho(link: LinkForAlert, payload: AlertPayload) {
  const prospect = link.prospects[0];
  return prospect?.company ?? payload.prospectName ?? prospect?.name ?? link.name ?? payload.prospectEmail ?? prospect?.email ?? "Un prospect";
}

export function alertMessage(type: SellerAlertType, link: LinkForAlert, payload: AlertPayload): AlertMessage {
  const appUrl = getPublicAppUrl();
  const who = alertWho(link, payload);
  const doc = `« ${link.document.name} »`;
  const linkUrl = `${appUrl}/links/${link.id}`;

  switch (type) {
    case "PROSPECT_VALIDATED": {
      const blocks: EmailBlock[] = [
        { kind: "text", text: `${who} vient de cliquer sur « Valider & signer » sur ${doc}. La page lui a annoncé un retour rapide de votre part.` },
      ];
      if (payload.message) blocks.push({ kind: "quote", text: payload.message });
      blocks.push({ kind: "button", label: "Voir le deal", href: linkUrl });
      return { subject: `${who} a validé votre proposition`, line: `${who} a validé ${doc}`, blocks, url: linkUrl };
    }
    case "CHANGE_REQUESTED": {
      const blocks: EmailBlock[] = [{ kind: "text", text: `${who} demande un ajustement sur ${doc}.` }];
      if (payload.message) blocks.push({ kind: "quote", text: payload.message });
      if (payload.prospectEmail) {
        blocks.push({
          kind: "button",
          label: "Lui répondre",
          href: `mailto:${payload.prospectEmail}?subject=${encodeURIComponent(`Re: ${link.document.name}`)}`,
        });
      }
      blocks.push({ kind: "text", text: `Le deal : ${linkUrl}` });
      return {
        subject: `${who} demande un ajustement`,
        line: `${who} demande un ajustement sur ${doc}${payload.message ? ` : « ${payload.message.slice(0, 200)} »` : ""}`,
        blocks,
        url: linkUrl,
      };
    }
    case "DRAFT_READY": {
      const url = `${linkUrl}#relances`;
      return {
        subject: `Relance à valider : ${who}`,
        line: `Une relance pour ${who} (${doc}) attend votre accord`,
        blocks: [
          { kind: "text", text: `Une relance pour ${who} (${doc}) est prête. Relisez-la et validez-la : rien ne part sans vous.` },
          { kind: "button", label: "Relire la relance", href: url },
        ],
        url,
      };
    }
    default: {
      // CALL_MOMENT and the older hot-lead types
      const reason =
        payload.reason ??
        (type === "MULTI_VIEWER"
          ? `${payload.liveViewers ?? "Plusieurs"} personnes lisent en même temps`
          : `Revient après ${payload.inactiveDays ?? "quelques"} jours sans lecture`);
      return {
        subject: `${who} lit votre proposition en ce moment`,
        line: `${who} lit ${doc} en ce moment. ${reason}, c'est le moment d'appeler.`,
        blocks: [
          { kind: "text", text: `${who} lit ${doc} en ce moment. ${reason}.` },
          { kind: "text", text: "C'est un bon moment pour appeler." },
          { kind: "button", label: "Voir la lecture en direct", href: linkUrl },
        ],
        url: linkUrl,
      };
    }
  }
}

/**
 * Stores the alert (visible in the dashboard and pulled by the extension) and
 * pushes it to the push channels. Silently ignores duplicates: false.
 */
export async function createAndDeliverAlert(input: AlertDelivery) {
  const link = await prisma.link.findUnique({
    where: { id: input.linkId },
    select: {
      id: true,
      name: true,
      prospects: { take: 1, orderBy: { createdAt: "asc" }, select: { name: true, email: true, company: true } },
      document: { select: { id: true, name: true } },
      organization: { select: { settings: true } },
    },
  });
  if (!link) return false;
  const settings = link.organization.settings;

  let alertId: string;
  try {
    const alert = await prisma.sellerAlert.create({
      data: {
        linkId: link.id,
        type: input.type,
        channels: input.channels,
        payload: input.payload,
        dedupeKey: input.dedupeKey,
        userId: input.userId,
        priority: input.priority,
      },
      select: { id: true },
    });
    alertId = alert.id;
  } catch (error) {
    if (isUniqueViolation(error)) return false;
    throw error;
  }

  const message = alertMessage(input.type, link, input.payload);
  const pushed = input.channels.filter((c) => c !== "EXTENSION");
  const errors: string[] = [];

  for (const channel of pushed) {
    try {
      if (channel === "EMAIL") {
        if (!isEmailConfigured()) throw new Error("aucun service d'email configuré");
        const recipients = [input.recipientEmail, input.copyTo].filter(
          (to, i, all): to is string => !!to && all.indexOf(to) === i,
        );
        if (!recipients.length) throw new Error("aucun email d'alerte");
        const { html, text } = renderEmail({
          preheader: message.line,
          title: message.subject,
          blocks: message.blocks,
          footer: { text: "Régler mes notifications", href: `${getPublicAppUrl()}/settings#alertes` },
        });
        for (const to of recipients) {
          await sendEmail({
            to,
            subject: message.subject,
            html,
            text,
            replyTo: input.type === "CHANGE_REQUESTED" ? (input.payload.prospectEmail ?? undefined) : undefined,
          });
        }
      } else if (channel === "SLACK") {
        if (!settings?.slackWebhookUrl) throw new Error("webhook Slack non configuré");
        const icon = input.priority === "ACTION" ? "✅" : input.type === "DRAFT_READY" ? "✍️" : "🔥";
        await postSlackMessage(decryptSecret(settings.slackWebhookUrl), `${icon} ${message.line}\n${message.url}`);
      } else if (channel === "WEBHOOK") {
        if (!settings?.outboundWebhookUrl || !settings.webhookSecret) throw new Error("webhook non configuré");
        const prospect = link.prospects[0];
        await postSignedWebhook(
          settings.outboundWebhookUrl,
          decryptSecret(settings.webhookSecret),
          `alert.${input.type.toLowerCase()}`,
          { linkId: link.id, documentId: link.document.id, prospect: input.payload.prospectEmail ?? prospect?.email ?? null, ...input.payload },
        );
      }
    } catch (error) {
      errors.push(`${channel}: ${error instanceof Error ? error.message : "échec"}`);
    }
  }

  // Extension-only alerts count as delivered once stored: the extension pulls them
  const delivered = pushed.length === 0 ? input.channels.length > 0 : errors.length < pushed.length;
  await prisma.sellerAlert.update({
    where: { id: alertId },
    data: {
      sentAt: delivered ? new Date() : null,
      error: errors.length ? errors.join(" · ") : null,
    },
  });
  return true;
}
