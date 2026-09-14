import type { SellerAlertType } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail, textToHtml } from "@/lib/email";

import { postSignedWebhook, postSlackMessage } from "../channels/webhooks";
import { isUniqueViolation } from "../followups/queue";

type AlertInput = {
  linkId: string;
  type: SellerAlertType;
  dedupeKey: string;
  payload: { liveViewers?: number; inactiveDays?: number };
};

function alertText(type: SellerAlertType, who: string, documentName: string, payload: AlertInput["payload"]) {
  if (type === "MULTI_VIEWER") {
    return `${payload.liveViewers} personnes lisent « ${documentName} » en ce moment (${who}). C'est le bon moment pour appeler.`;
  }
  return `${who} a rouvert « ${documentName} » après ${payload.inactiveDays} jours sans lecture. C'est le bon moment pour reprendre contact.`;
}

/**
 * Stores the alert (visible in the dashboard even when no channel is set up)
 * and pushes it to the workspace alert channels. Silently ignores duplicates.
 */
export async function createAndDeliverAlert(input: AlertInput) {
  const link = await prisma.link.findUnique({
    where: { id: input.linkId },
    include: {
      createdBy: { select: { email: true } },
      prospects: { take: 1, orderBy: { createdAt: "asc" } },
      document: { select: { id: true, name: true } },
      organization: { include: { settings: true } },
    },
  });
  if (!link) return;

  const settings = link.organization.settings;
  const channels = settings?.alertChannels ?? ["EMAIL"];

  let alertId: string;
  try {
    const alert = await prisma.sellerAlert.create({
      data: {
        linkId: link.id,
        type: input.type,
        channels,
        payload: input.payload,
        dedupeKey: input.dedupeKey,
      },
      select: { id: true },
    });
    alertId = alert.id;
  } catch (error) {
    if (isUniqueViolation(error)) return;
    throw error;
  }

  const prospect = link.prospects[0];
  const who = prospect?.company ?? prospect?.name ?? link.name ?? "Un prospect";
  const text = alertText(input.type, who, link.document.name, input.payload);
  const dashboardUrl = `${getPublicAppUrl()}/documents/${link.document.id}`;
  const errors: string[] = [];

  for (const channel of channels) {
    try {
      if (channel === "EMAIL") {
        const to = settings?.alertEmail ?? link.createdBy?.email;
        if (!to) throw new Error("aucun email d'alerte");
        if (!isEmailConfigured()) throw new Error("aucun service d'email configuré");
        await sendEmail({
          to,
          subject: `Hot lead : ${who}`,
          text: `${text}\n\n${dashboardUrl}`,
          html: textToHtml(`${text}\n\n${dashboardUrl}`),
        });
      } else if (channel === "SLACK") {
        if (!settings?.slackWebhookUrl) throw new Error("webhook Slack non configuré");
        await postSlackMessage(decryptSecret(settings.slackWebhookUrl), `🔥 ${text}\n${dashboardUrl}`);
      } else if (channel === "WEBHOOK") {
        if (!settings?.outboundWebhookUrl || !settings.webhookSecret) throw new Error("webhook non configuré");
        await postSignedWebhook(
          settings.outboundWebhookUrl,
          decryptSecret(settings.webhookSecret),
          `alert.${input.type.toLowerCase()}`,
          { linkId: link.id, documentId: link.document.id, prospect: prospect?.email ?? null, ...input.payload },
        );
      }
    } catch (error) {
      errors.push(`${channel}: ${error instanceof Error ? error.message : "échec"}`);
    }
  }

  await prisma.sellerAlert.update({
    where: { id: alertId },
    data: {
      sentAt: errors.length < channels.length ? new Date() : null,
      error: errors.length ? errors.join(" · ") : null,
    },
  });
}
