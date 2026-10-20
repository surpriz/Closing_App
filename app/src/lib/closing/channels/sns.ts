import { createVerify, timingSafeEqual } from "node:crypto";

import { z } from "zod";

/**
 * Amazon SNS posts SES notifications (deliveries, bounces, complaints, received replies) to our
 * webhooks. A message is trusted when its signature checks out against a certificate served by
 * SNS itself, and the URL carries our token: anyone can post JSON, nobody else can sign it.
 */

export const snsMessageSchema = z.object({
  Type: z.enum(["Notification", "SubscriptionConfirmation", "UnsubscribeConfirmation"]),
  MessageId: z.string(),
  TopicArn: z.string(),
  Message: z.string(),
  Timestamp: z.string(),
  SignatureVersion: z.enum(["1", "2"]),
  Signature: z.string(),
  SigningCertURL: z.string(),
  Subject: z.string().nullish(),
  SubscribeURL: z.string().nullish(),
  Token: z.string().nullish(),
});

export type SnsMessage = z.infer<typeof snsMessageSchema>;

/** Only certificates SNS serves itself: a forged message would point to the forger's certificate. */
export function isSnsHostedUrl(raw: string | null | undefined) {
  if (!raw) return false;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/.test(url.hostname);
  } catch {
    return false;
  }
}

/** The text SNS signed, field order fixed by AWS. */
export function snsStringToSign(message: SnsMessage) {
  const fields: [string, string | null | undefined][] =
    message.Type === "Notification"
      ? [
          ["Message", message.Message],
          ["MessageId", message.MessageId],
          ["Subject", message.Subject],
          ["Timestamp", message.Timestamp],
          ["TopicArn", message.TopicArn],
          ["Type", message.Type],
        ]
      : [
          ["Message", message.Message],
          ["MessageId", message.MessageId],
          ["SubscribeURL", message.SubscribeURL],
          ["Timestamp", message.Timestamp],
          ["Token", message.Token],
          ["TopicArn", message.TopicArn],
          ["Type", message.Type],
        ];
  return fields
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => `${key}\n${value}\n`)
    .join("");
}

const certificates = new Map<string, Promise<string>>();

async function fetchCertificate(url: string) {
  let cached = certificates.get(url);
  if (!cached) {
    cached = fetch(url, { signal: AbortSignal.timeout(5000) }).then((response) => {
      if (!response.ok) throw new Error(`certificate ${response.status}`);
      return response.text();
    });
    certificates.set(url, cached);
    cached.catch(() => certificates.delete(url));
  }
  return cached;
}

export async function verifySnsMessage(message: SnsMessage, getCertificate = fetchCertificate) {
  if (!isSnsHostedUrl(message.SigningCertURL)) return false;
  try {
    const certificate = await getCertificate(message.SigningCertURL);
    const verifier = createVerify(message.SignatureVersion === "1" ? "RSA-SHA1" : "RSA-SHA256");
    verifier.update(snsStringToSign(message), "utf8");
    return verifier.verify(certificate, message.Signature, "base64");
  } catch {
    return false;
  }
}

/** `?token=` on the subscription URL, compared in constant time. Unset secret: the webhook is off. */
export function hasWebhookToken(request: Request, secret: string | undefined) {
  if (!secret) return false;
  const given = Buffer.from(new URL(request.url).searchParams.get("token") ?? "");
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Reads, checks and unwraps one SNS post. Confirms a new subscription on the way (SNS waits for it
 * before sending anything). Returns the notification body, or null when there is nothing to process.
 */
export async function receiveSnsPost(request: Request, secret: string | undefined): Promise<
  { ok: false; status: number } | { ok: true; message: string | null; topicArn: string }
> {
  if (!hasWebhookToken(request, secret)) return { ok: false, status: 401 };
  // SNS posts JSON as text/plain
  const parsed = snsMessageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { ok: false, status: 400 };
  const message = parsed.data;
  if (!(await verifySnsMessage(message))) return { ok: false, status: 403 };

  if (message.Type === "SubscriptionConfirmation") {
    if (!isSnsHostedUrl(message.SubscribeURL)) return { ok: false, status: 400 };
    const response = await fetch(message.SubscribeURL!, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { ok: false, status: 502 };
    return { ok: true, message: null, topicArn: message.TopicArn };
  }
  if (message.Type === "UnsubscribeConfirmation") return { ok: true, message: null, topicArn: message.TopicArn };
  return { ok: true, message: message.Message, topicArn: message.TopicArn };
}
