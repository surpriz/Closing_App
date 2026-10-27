import type { AlertPriority, ProspectRole, SellerAlertChannel, SellerAlertType } from "@/generated/prisma/enums";
import { getPublicAppUrl } from "@/lib/app-origin";
import { decryptSecret } from "@/lib/crypto";
import { prisma } from "@/lib/db";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { DEFAULT_UI_LOCALE, INTL_LOCALE, type UiLocale } from "@/i18n/locale";
import { getTranslator } from "@/i18n/messages";
import { renderEmail, type EmailBlock } from "@/lib/email-layout";
import { getSellerLocale } from "@/lib/seller-locale";
import { getNamespaceTranslator, type ServerT } from "@/lib/server-translator";

import { escapeSlackText, postSignedWebhook, postSlackMessage } from "../channels/webhooks";
import { formatDeadline } from "../expiry";
import { isUniqueViolation } from "../followups/queue";
import type { SmartLinkProblem } from "../shared/smart-params";

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
  /** VOICE_COMMENT: the page it was left on, and what was said when the transcription worked. */
  pageNumber?: number;
  transcript?: string | null;
  /** MEETING_BOOKED: start of the meeting, ISO, when the widget gave it (Cal.com). */
  meetingAt?: string | null;
  /** DOCUMENT_FORWARDED: who passed it to whom; prospectEmail is the forwarder, for replies. */
  forwardedBy?: string | null;
  forwardedTo?: string;
  forwardedToEmail?: string;
  forwardedToRole?: ProspectRole | null;
  /** The recipient looks like someone who signs or holds the budget. */
  decisionMaker?: boolean;
  /** PROSPECT_REPLIED: the start of the answer, and where Clozer caught it. */
  replyExcerpt?: string | null;
  replySource?: "INBOUND" | "EXTENSION";
  /** Revival alerts: who came back, and why the link no longer opened. */
  prospectId?: string | null;
  deadState?: "archived" | "expired";
  /** SMART_LINK_PROBLEM: a personal link got ?email=, or the tool left its variable (`tag`) as is. */
  smartProblem?: SmartLinkProblem;
  tag?: string | null;
};

const READER_ALERTS = new Set<SellerAlertType>(["COMMITTEE_LIVE", "DECISION_MAKER_DETECTED", "NEW_READER"]);
/** Alerts the seller answers straight to the prospect: the email replies to them. */
const REPLY_ALERTS = new Set<SellerAlertType>([
  "CHANGE_REQUESTED",
  "QUOTE_REQUESTED",
  "PROSPECT_QUESTION",
  "LINK_EXTENSION_REQUESTED",
  "VOICE_COMMENT",
  "MEETING_BOOKED",
  "DOCUMENT_FORWARDED",
  "PROSPECT_REPLIED",
  "RELINK_REQUESTED",
]);

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

export function alertWho(link: LinkForAlert, payload: AlertPayload, locale: UiLocale) {
  const prospect = link.prospects[0];
  return (
    prospect?.company ??
    payload.prospectName ??
    prospect?.name ??
    link.name ??
    payload.prospectEmail ??
    prospect?.email ??
    getTranslator(locale)("alerts.common.someone")
  );
}

function replyButton(link: LinkForAlert, payload: AlertPayload, t: ServerT<"alerts">): EmailBlock | null {
  if (!payload.prospectEmail) return null;
  return {
    kind: "button",
    label: t("common.reply"),
    href: `mailto:${payload.prospectEmail}?subject=${encodeURIComponent(`Re: ${link.document.name}`)}`,
  };
}

export function alertMessage(
  type: SellerAlertType,
  link: LinkForAlert,
  payload: AlertPayload,
  timezone = "Europe/Paris",
  locale: UiLocale = DEFAULT_UI_LOCALE,
): AlertMessage {
  const t = getNamespaceTranslator(locale, "alerts");
  const appUrl = getPublicAppUrl();
  const who = alertWho(link, payload, locale);
  const doc = t("common.doc", { name: link.document.name });
  const linkUrl = `${appUrl}/links/${link.id}`;
  const date = (iso: string) => formatDeadline(new Date(iso), INTL_LOCALE[locale], timezone);
  const deadline = payload.expiresAt ? date(payload.expiresAt) : null;
  const lineQuote = (text: string | null | undefined) => (text ? t("common.lineQuote", { text: text.slice(0, 200) }) : "");
  const viewDeal: EmailBlock = { kind: "button", label: t("common.viewDeal"), href: linkUrl };

  switch (type) {
    case "LINK_EXTENSION_REQUESTED": {
      const url = `${linkUrl}#expiration`;
      const blocks: EmailBlock[] = [
        { kind: "text", text: t("message.linkExtensionRequested.body", { doc, who }) },
        { kind: "button", label: t("message.linkExtensionRequested.button"), href: url },
      ];
      if (payload.prospectEmail) {
        blocks.push({ kind: "text", text: t("message.linkExtensionRequested.email", { email: payload.prospectEmail }) });
      }
      return {
        subject: t("message.linkExtensionRequested.subject", { who }),
        line: t("message.linkExtensionRequested.line", { who, doc }),
        blocks,
        url,
      };
    }
    case "RELINK_REQUESTED": {
      const url = `${linkUrl}#reactiver`;
      const blocks: EmailBlock[] = [
        { kind: "text", text: t("message.relinkRequested.body", { doc, who }) },
        { kind: "button", label: t("message.relinkRequested.button"), href: url },
      ];
      if (payload.prospectEmail) {
        blocks.push({ kind: "text", text: t("message.relinkRequested.email", { email: payload.prospectEmail }) });
      }
      return {
        subject: t("message.relinkRequested.subject", { who }),
        line: t("message.relinkRequested.line", { who, doc }),
        blocks,
        url,
      };
    }
    case "SMART_LINK_PROBLEM": {
      const personal = payload.smartProblem === "personal_link";
      const url = personal ? `${appUrl}/documents/${link.document.id}` : linkUrl;
      const tag = payload.tag ?? "{{email}}";
      return {
        subject: t(personal ? "message.smartLinkProblem.subjectPersonal" : "message.smartLinkProblem.subjectTag", { tag }),
        line: t(personal ? "message.smartLinkProblem.linePersonal" : "message.smartLinkProblem.lineTag", { doc, tag }),
        blocks: [
          {
            kind: "text",
            text: t(personal ? "message.smartLinkProblem.bodyPersonal" : "message.smartLinkProblem.bodyTag", { doc, tag }),
          },
          {
            kind: "button",
            label: t(personal ? "message.smartLinkProblem.buttonPersonal" : "message.smartLinkProblem.buttonTag"),
            href: url,
          },
        ],
        url,
      };
    }
    case "DEAD_LINK_OPENED": {
      const url = `${linkUrl}#reactiver`;
      const archived = payload.deadState !== "expired";
      return {
        subject: t("message.deadLinkOpened.subject", { who }),
        line: t(archived ? "message.deadLinkOpened.lineArchived" : "message.deadLinkOpened.lineExpired", { who, doc }),
        blocks: [
          {
            kind: "text",
            text: t(archived ? "message.deadLinkOpened.bodyArchived" : "message.deadLinkOpened.bodyExpired", { who, doc }),
          },
          { kind: "button", label: t("message.deadLinkOpened.button"), href: url },
        ],
        url,
      };
    }
    case "LINK_EXPIRING": {
      const url = `${linkUrl}#expiration`;
      return {
        subject: t("message.linkExpiring.subject", { who }),
        line: deadline
          ? t("message.linkExpiring.lineDate", { doc, who, date: deadline })
          : t("message.linkExpiring.lineSoon", { doc, who }),
        blocks: [
          {
            kind: "text",
            text: deadline
              ? t("message.linkExpiring.bodyDate", { doc, who, date: deadline })
              : t("message.linkExpiring.bodyTomorrow", { doc, who }),
          },
          { ...viewDeal, href: url },
        ],
        url,
      };
    }
    case "PROSPECT_VALIDATED": {
      const blocks: EmailBlock[] = [{ kind: "text", text: t("message.prospectValidated.body", { who, doc }) }];
      if (payload.message) blocks.push({ kind: "quote", text: payload.message });
      blocks.push(viewDeal);
      return {
        subject: t("message.prospectValidated.subject", { who }),
        line: t("message.prospectValidated.line", { who, doc }),
        blocks,
        url: linkUrl,
      };
    }
    case "MEETING_BOOKED": {
      const when = payload.meetingAt ? date(payload.meetingAt) : null;
      const blocks: EmailBlock[] = [
        {
          kind: "text",
          text: when
            ? t("message.meetingBooked.bodyDate", { who, doc, date: when })
            : t("message.meetingBooked.body", { who, doc }),
        },
      ];
      if (!when) blocks.push({ kind: "text", text: t("message.meetingBooked.noDate") });
      const reply = replyButton(link, payload, t);
      if (reply) blocks.push(reply);
      blocks.push(viewDeal);
      return {
        subject: when ? t("message.meetingBooked.subjectDate", { who, date: when }) : t("message.meetingBooked.subject", { who }),
        line: when
          ? t("message.meetingBooked.lineDate", { who, date: when, doc })
          : t("message.meetingBooked.line", { who, doc }),
        blocks,
        url: linkUrl,
      };
    }
    case "CHANGE_REQUESTED": {
      const blocks: EmailBlock[] = [{ kind: "text", text: t("message.changeRequested.body", { who, doc }) }];
      if (payload.message) blocks.push({ kind: "quote", text: payload.message });
      const reply = replyButton(link, payload, t);
      if (reply) blocks.push(reply);
      blocks.push({ kind: "text", text: t("common.dealLine", { url: linkUrl }) });
      return {
        subject: t("message.changeRequested.subject", { who }),
        line: `${t("message.changeRequested.line", { who, doc })}${lineQuote(payload.message)}`,
        blocks,
        url: linkUrl,
      };
    }
    case "QUOTE_REQUESTED": {
      const blocks: EmailBlock[] = [{ kind: "text", text: t("message.quoteRequested.body", { who, doc }) }];
      if (payload.message) blocks.push({ kind: "quote", text: payload.message });
      const reply = replyButton(link, payload, t);
      if (reply) blocks.push(reply);
      blocks.push({ kind: "text", text: t("common.dealLine", { url: linkUrl }) });
      return {
        subject: t("message.quoteRequested.subject", { who }),
        line: `${t("message.quoteRequested.line", { who, doc })}${lineQuote(payload.message)}`,
        blocks,
        url: linkUrl,
      };
    }
    case "PROSPECT_QUESTION": {
      const blocks: EmailBlock[] = [{ kind: "text", text: t("message.prospectQuestion.body", { who, doc }) }];
      if (payload.question) blocks.push({ kind: "quote", text: payload.question });
      const reply = replyButton(link, payload, t);
      if (reply) blocks.push(reply);
      const url = `${linkUrl}#questions`;
      blocks.push({ kind: "text", text: t("message.prospectQuestion.dealAndChat", { url }) });
      return {
        subject: t("message.prospectQuestion.subject", { who }),
        line: `${t("message.prospectQuestion.line", { who, doc })}${lineQuote(payload.question)}`,
        blocks,
        url,
      };
    }
    case "VOICE_COMMENT": {
      const page = payload.pageNumber;
      const blocks: EmailBlock[] = [
        {
          kind: "text",
          text: page ? t("message.voiceComment.bodyPage", { who, page, doc }) : t("message.voiceComment.body", { who, doc }),
        },
      ];
      blocks.push(
        payload.transcript
          ? { kind: "quote", text: payload.transcript }
          : { kind: "text", text: t("message.voiceComment.noTranscript") },
      );
      const reply = replyButton(link, payload, t);
      if (reply) blocks.push(reply);
      const url = `${linkUrl}#vocaux`;
      blocks.push({ kind: "text", text: t("message.voiceComment.listen", { url }) });
      return {
        subject: t("message.voiceComment.subject", { who }),
        line: `${page ? t("message.voiceComment.linePage", { who, page, doc }) : t("message.voiceComment.line", { who, doc })}${lineQuote(payload.transcript)}`,
        blocks,
        url,
      };
    }
    case "DOCUMENT_FORWARDED": {
      const url = `${linkUrl}#circuit`;
      const from = payload.forwardedBy ?? who;
      const to = payload.forwardedTo ?? t("message.documentForwarded.someone");
      const role = payload.forwardedToRole
        ? ` (${getNamespaceTranslator(locale, "labels")(`prospectRole.${payload.forwardedToRole}`)})`
        : "";
      const blocks: EmailBlock[] = [
        {
          kind: "text",
          text: t(payload.decisionMaker ? "message.documentForwarded.bodyDecision" : "message.documentForwarded.body", {
            from,
            doc,
            to,
            role,
          }),
        },
      ];
      if (payload.message) blocks.push({ kind: "quote", text: payload.message });
      if (payload.forwardedToEmail) {
        blocks.push({ kind: "text", text: t("message.documentForwarded.email", { email: payload.forwardedToEmail }) });
      }
      const reply = replyButton(link, payload, t);
      if (reply?.kind === "button") blocks.push({ ...reply, label: t("message.documentForwarded.writeTo", { name: from }) });
      blocks.push({ kind: "button", label: t("message.documentForwarded.button"), href: url });
      return {
        subject: payload.decisionMaker
          ? t("message.documentForwarded.subjectDecision", { to, role })
          : t("message.documentForwarded.subject", { from, to }),
        line: t("message.documentForwarded.line", { from, doc, to, role, quote: lineQuote(payload.message) }),
        blocks,
        url,
      };
    }
    case "PROSPECT_REPLIED": {
      const blocks: EmailBlock[] = [
        {
          kind: "text",
          text: t(payload.replySource === "EXTENSION" ? "message.prospectReplied.bodyThread" : "message.prospectReplied.body", { who, doc }),
        },
      ];
      if (payload.replyExcerpt) blocks.push({ kind: "quote", text: payload.replyExcerpt });
      blocks.push({ kind: "text", text: t("message.prospectReplied.stopped") });
      const reply = replyButton(link, payload, t);
      if (reply) blocks.push(reply);
      blocks.push(viewDeal);
      return {
        subject: t("message.prospectReplied.subject", { who }),
        line: `${t("message.prospectReplied.line", { who, doc })}${lineQuote(payload.replyExcerpt)}`,
        blocks,
        url: linkUrl,
      };
    }
    case "EMAIL_BOUNCED": {
      const email = payload.prospectEmail ?? who;
      const blocks: EmailBlock[] = [{ kind: "text", text: t("message.emailBounced.body", { email, doc }) }];
      if (payload.detail) blocks.push({ kind: "quote", text: payload.detail });
      blocks.push({ kind: "text", text: t("message.emailBounced.fix") });
      blocks.push(viewDeal);
      return {
        subject: t("message.emailBounced.subject", { email }),
        line: t("message.emailBounced.line", { email, doc }),
        blocks,
        url: linkUrl,
      };
    }
    case "DRAFT_READY": {
      const url = `${linkUrl}#relances`;
      return {
        subject: t("message.draftReady.subject", { who }),
        line: t("message.draftReady.line", { who, doc }),
        blocks: [
          { kind: "text", text: t("message.draftReady.body", { who, doc }) },
          { kind: "button", label: t("message.draftReady.button"), href: url },
        ],
        url,
      };
    }
    case "COMMITTEE_LIVE":
    case "DECISION_MAKER_DETECTED":
    case "NEW_READER": {
      const url = `${linkUrl}#qui-lit`;
      const reason = payload.reason ?? t("message.readers.reasonFallback");
      const subject =
        type === "COMMITTEE_LIVE"
          ? payload.liveViewers
            ? t("message.readers.subjectCommittee", { who, count: payload.liveViewers })
            : t("message.readers.subjectCommitteeMany", { who })
          : type === "DECISION_MAKER_DETECTED"
            ? t("message.readers.subjectDecisionMaker", { who })
            : payload.readerOrigin === "forwarded_internal"
              ? t("message.readers.subjectForwarded", { who })
              : t("message.readers.subjectNewReader");
      const hint = type === "COMMITTEE_LIVE" ? t("message.readers.hintCommittee") : t("message.readers.hint");
      return {
        subject,
        line: t("message.readers.line", { who, doc, reason, hint }),
        blocks: [
          { kind: "text", text: t("message.readers.body", { reason, doc }) },
          { kind: "text", text: hint },
          { kind: "button", label: t("message.readers.button"), href: url },
        ],
        url,
      };
    }
    default: {
      // CALL_MOMENT and the older hot-lead types
      const reason =
        payload.reason ??
        (type === "MULTI_VIEWER"
          ? payload.liveViewers
            ? t("message.hot.reasonMulti", { count: payload.liveViewers })
            : t("message.hot.reasonMultiMany")
          : payload.inactiveDays
            ? t("message.hot.reasonBack", { days: payload.inactiveDays })
            : t("message.hot.reasonBackSome"));
      return {
        subject: t("message.hot.subject", { who }),
        line: t("message.hot.line", { who, doc, reason }),
        blocks: [
          { kind: "text", text: t("message.hot.body", { who, doc, reason }) },
          { kind: "text", text: t("message.hot.goodMoment") },
          { kind: "button", label: t("message.hot.button"), href: linkUrl },
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

  const locale = await getSellerLocale(input.userId);
  const message = alertMessage(input.type, link, input.payload, input.timezone, locale);
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
          locale,
          preheader: message.line,
          title: message.subject,
          blocks: message.blocks,
          footer: { text: getTranslator(locale)("alerts.common.footer"), href: `${getPublicAppUrl()}/settings#alertes` },
        });
        for (const to of recipients) {
          await sendEmail({
            to,
            subject: message.subject,
            html,
            text,
            replyTo: REPLY_ALERTS.has(input.type) ? (input.payload.prospectEmail ?? undefined) : undefined,
          });
        }
      } else if (channel === "SLACK") {
        if (!settings?.slackWebhookUrl) throw new Error("webhook Slack non configuré");
        const icon =
          input.type === "PROSPECT_QUESTION"
            ? "❓"
            : input.type === "VOICE_COMMENT"
              ? "🎙️"
              : input.type === "MEETING_BOOKED"
                ? "📅"
              : input.type === "DOCUMENT_FORWARDED"
                ? "↪️"
              : input.type === "PROSPECT_REPLIED"
                ? "💬"
              : input.type === "EMAIL_BOUNCED" || input.type === "SMART_LINK_PROBLEM"
                ? "⚠️"
              : input.type === "RELINK_REQUESTED" || input.type === "DEAD_LINK_OPENED"
                ? "🔁"
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
