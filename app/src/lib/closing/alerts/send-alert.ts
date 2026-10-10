import type { AlertPriority, SellerAlertChannel, SellerAlertType } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { renderEmail, type EmailBlock } from "@/lib/email-layout";

import { escapeSlackText, postSignedWebhook, postSlackMessage } from "../channels/webhooks";
import { formatDeadline } from "../expiry";
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
  /** Reader alerts (committee/signals.ts) */
  readerName?: string;
  readerOrigin?: string;
  readerDomain?: string;
  decisionMakers?: string[];
  /** PROSPECT_QUESTION: what the assistant could not answer. */
  question?: string;
  /** Expiry alerts: the link's deadline, ISO. */
  expiresAt?: string;
};

const READER_ALERTS = new Set<SellerAlertType>(["COMMITTEE_LIVE", "DECISION_MAKER_DETECTED", "NEW_READER"]);

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
  /** Seller time zone, for dates written in the message. */
  timezone?: string;
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

export function alertMessage(
  type: SellerAlertType,
  link: LinkForAlert,
  payload: AlertPayload,
  timezone = "Europe/Paris",
): AlertMessage {
  const appUrl = getPublicAppUrl();
  const who = alertWho(link, payload);
  const doc = `« ${link.document.name} »`;
  const linkUrl = `${appUrl}/links/${link.id}`;
  const deadline = payload.expiresAt ? formatDeadline(new Date(payload.expiresAt), "fr-FR", timezone) : null;

  switch (type) {
    case "LINK_EXTENSION_REQUESTED": {
      const url = `${linkUrl}#expiration`;
      const blocks: EmailBlock[] = [
        { kind: "text", text: `Le lien vers ${doc} a expiré. ${who} demande à pouvoir le rouvrir.` },
        { kind: "button", label: "Prolonger le lien", href: url },
      ];
      if (payload.prospectEmail) blocks.push({ kind: "text", text: `Son email : ${payload.prospectEmail}` });
      return {
        subject: `${who} demande une prolongation`,
        line: `${who} demande une prolongation de ${doc}, qui a expiré`,
        blocks,
        url,
      };
    }
    case "LINK_EXPIRING": {
      const url = `${linkUrl}#expiration`;
      const when = deadline ? `le ${deadline}` : "dans moins de 24 h";
      return {
        subject: `Le lien de ${who} expire demain`,
        line: `${doc} (${who}) expire ${when}`,
        blocks: [
          { kind: "text", text: `${doc} ne sera plus accessible à ${who} après ${deadline ? `le ${deadline}` : "demain"}. Prolongez-le ou relancez d'ici là.` },
          { kind: "button", label: "Voir le deal", href: url },
        ],
        url,
      };
    }
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
    case "PROSPECT_QUESTION": {
      const blocks: EmailBlock[] = [
        {
          kind: "text",
          text: `${who} a posé une question sur ${doc}. L'assistant n'a pas pu répondre et lui a dit que vous reviendriez vers lui.`,
        },
      ];
      if (payload.question) blocks.push({ kind: "quote", text: payload.question });
      if (payload.prospectEmail) {
        blocks.push({
          kind: "button",
          label: "Lui répondre",
          href: `mailto:${payload.prospectEmail}?subject=${encodeURIComponent(`Re: ${link.document.name}`)}`,
        });
      }
      const url = `${linkUrl}#questions`;
      blocks.push({ kind: "text", text: `Le deal et la conversation : ${url}` });
      return {
        subject: `${who} a une question sur votre proposition`,
        line: `${who} a une question sur ${doc}${payload.question ? ` : « ${payload.question.slice(0, 200)} »` : ""}`,
        blocks,
        url,
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
    case "COMMITTEE_LIVE":
    case "DECISION_MAKER_DETECTED":
    case "NEW_READER": {
      const url = `${linkUrl}#qui-lit`;
      const reason = payload.reason ?? "Quelqu'un de nouveau lit votre proposition";
      const subject =
        type === "COMMITTEE_LIVE"
          ? `${who} : ${payload.liveViewers ?? "plusieurs"} personnes lisent votre proposition`
          : type === "DECISION_MAKER_DETECTED"
            ? `Un décideur de ${who} lit votre proposition`
            : payload.readerOrigin === "forwarded_internal"
              ? `${who} a repartagé votre proposition`
              : "Nouveau lecteur sur votre proposition";
      const hint = type === "COMMITTEE_LIVE" ? "Le comité regarde, c'est le moment d'appeler." : "C'est le moment de reprendre contact.";
      return {
        subject,
        line: `${who} · ${doc} : ${reason}. ${hint}`,
        blocks: [
          { kind: "text", text: `${reason} (${doc}).` },
          { kind: "text", text: hint },
          { kind: "button", label: "Voir qui lit", href: url },
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

  const message = alertMessage(input.type, link, input.payload, input.timezone);
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
            replyTo:
              input.type === "CHANGE_REQUESTED" ||
              input.type === "PROSPECT_QUESTION" ||
              input.type === "LINK_EXTENSION_REQUESTED"
                ? (input.payload.prospectEmail ?? undefined)
                : undefined,
          });
        }
      } else if (channel === "SLACK") {
        if (!settings?.slackWebhookUrl) throw new Error("webhook Slack non configuré");
        const icon =
          input.type === "PROSPECT_QUESTION"
            ? "❓"
            : input.type === "LINK_EXTENSION_REQUESTED" || input.type === "LINK_EXPIRING"
              ? "⏳"
              : input.priority === "ACTION"
              ? "✅"
              : input.type === "DRAFT_READY"
                ? "✍️"
                : READER_ALERTS.has(input.type)
                  ? "👥"
                  : "🔥";
        await postSlackMessage(decryptSecret(settings.slackWebhookUrl), `${icon} ${escapeSlackText(message.line)}\n${message.url}`);
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
