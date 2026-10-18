import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import PostalMime from "postal-mime";
import { z } from "zod";

import { prisma } from "@/lib/db";

import { parseReplyAddress, replyAddress } from "./address";
import { recordProspectReply } from "./record";
import { isAutoReply, replyExcerpt } from "./text";

/**
 * The reply relay. Follow-ups carry two Reply-To addresses: the seller's, and r-<id>@<domain>.
 * A prospect who answers writes to both: the seller gets the email as usual, straight from the
 * prospect, and SES hands Clozer its copy here. Nothing depends on Clozer passing the email on,
 * so a relay outage loses a notification, never a reply.
 */

function relaySecret() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  return secret;
}

export function isReplyRelayConfigured() {
  return !!(process.env.INBOUND_REPLY_DOMAIN && process.env.SES_WEBHOOK_TOKEN);
}

/** The relay address for this follow-up, or null when the relay is off. */
export function replyRelayAddress(followupId: string) {
  const domain = process.env.INBOUND_REPLY_DOMAIN;
  if (!domain || !isReplyRelayConfigured()) return null;
  return replyAddress(followupId, domain, relaySecret());
}

const receivedSchema = z.object({
  notificationType: z.literal("Received"),
  content: z.string().nullish(),
  mail: z.object({
    messageId: z.string(),
    timestamp: z.string().optional(),
    source: z.string().optional(),
    commonHeaders: z.object({ from: z.array(z.string()).nullish(), subject: z.string().nullish() }).partial().optional(),
    headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
  }),
  receipt: z.object({
    recipients: z.array(z.string()),
    spamVerdict: z.object({ status: z.string() }).optional(),
    virusVerdict: z.object({ status: z.string() }).optional(),
    action: z.object({
      type: z.string(),
      bucketName: z.string().optional(),
      objectKey: z.string().optional(),
      encoding: z.string().optional(),
    }),
  }),
});

export type InboundOutcome = "logged" | "duplicate" | "auto_reply" | "not_a_relay" | "rejected" | "unknown_followup" | "ignored";

let s3: S3Client | undefined;

async function readRawEmail(notification: z.infer<typeof receivedSchema>) {
  const { action } = notification.receipt;
  if (notification.content) {
    return action.encoding === "BASE64" ? Buffer.from(notification.content, "base64") : notification.content;
  }
  // Only the bucket we were told about: the notification names it, it must not choose it
  const bucket = process.env.INBOUND_REPLY_BUCKET;
  if (action.type !== "S3" || !bucket || action.bucketName !== bucket || !action.objectKey) return null;
  s3 ??= new S3Client({
    region: process.env.SES_REGION,
    credentials: { accessKeyId: process.env.SES_ACCESS_KEY_ID!, secretAccessKey: process.env.SES_SECRET_ACCESS_KEY! },
  });
  const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: action.objectKey }));
  return object.Body ? Buffer.from(await object.Body.transformToByteArray()) : null;
}

function htmlToText(html: string) {
  return html
    .replace(/<(br|\/p|\/div|\/li)[^>]*>/gi, "\n")
    .replace(/<blockquote[\s\S]*$/i, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"');
}

export async function handleInboundReply(raw: unknown): Promise<InboundOutcome> {
  const parsed = receivedSchema.safeParse(raw);
  if (!parsed.success) return "ignored";
  const notification = parsed.data;
  const domain = process.env.INBOUND_REPLY_DOMAIN;
  if (!domain) return "not_a_relay";

  const secret = relaySecret();
  const followupId = notification.receipt.recipients
    .map((recipient) => parseReplyAddress(recipient, domain, secret))
    .find((id): id is string => !!id);
  if (!followupId) return "not_a_relay";
  if (notification.receipt.spamVerdict?.status === "FAIL" || notification.receipt.virusVerdict?.status === "FAIL") {
    return "rejected";
  }

  const followup = await prisma.followup.findUnique({
    where: { id: followupId },
    select: { id: true, linkId: true, prospectId: true, link: { select: { prospects: { select: { id: true, email: true } } } } },
  });
  if (!followup) return "unknown_followup";

  const headers = Object.fromEntries(
    (notification.mail.headers ?? []).map((header) => [header.name.toLowerCase(), header.value] as const),
  );
  const rawEmail = await readRawEmail(notification).catch((error) => {
    console.error("[replies:inbound] could not read the email", error);
    return null;
  });
  const email = rawEmail ? await PostalMime.parse(rawEmail).catch(() => null) : null;
  const subject = email?.subject ?? notification.mail.commonHeaders?.subject ?? null;
  if (isAutoReply(headers, subject)) return "auto_reply";

  const from = email?.from && "address" in email.from && email.from.address ? email.from : null;
  const fromEmail = (from?.address ?? notification.mail.source ?? "").toLowerCase();
  if (!fromEmail) return "ignored";
  const prospect = followup.link.prospects.find((p) => p.email.toLowerCase() === fromEmail);

  const messageId = email?.messageId ?? headers["message-id"] ?? notification.mail.messageId;
  const logged = await recordProspectReply({
    linkId: followup.linkId,
    // Someone else from the prospect's side may answer: the reply still counts, on the deal
    prospectId: prospect?.id ?? null,
    followupId: followup.id,
    fromEmail,
    fromName: from?.name || null,
    excerpt: replyExcerpt(email?.text ?? (email?.html ? htmlToText(email.html) : null)),
    occurredAt: notification.mail.timestamp ? new Date(notification.mail.timestamp) : new Date(),
    source: "INBOUND",
    externalKey: `mail:${messageId}`.slice(0, 500),
  });
  return logged ? "logged" : "duplicate";
}
