import { signPayload } from "@/lib/crypto";

const PRIVATE_HOST =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0|\[?::1\]?)/i;

// Basic SSRF guard for user-provided URLs
export function isSafeOutboundUrl(value: string) {
  try {
    const url = new URL(value);
    if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return false;
    if (!["https:", "http:"].includes(url.protocol)) return false;
    return process.env.NODE_ENV !== "production" || !PRIVATE_HOST.test(url.hostname);
  } catch {
    return false;
  }
}

export async function postSlackMessage(webhookUrl: string, text: string) {
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Slack ${response.status}`);
}

export async function postSignedWebhook(url: string, secret: string, event: string, payload: unknown) {
  if (!isSafeOutboundUrl(url)) throw new Error("Webhook URL not allowed");

  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), data: payload });
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Closing-Event": event,
      "X-Closing-Signature": `sha256=${signPayload(body, secret)}`,
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Webhook ${response.status}`);
}
