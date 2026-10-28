import { after } from "next/server";

const CAPTURE_URL = "https://eu.i.posthog.com/i/v0/e/";

export type ProductEvent = "signed_up" | "workspace_created" | "link_created" | "proposal_opened" | "plan_changed";

async function send(event: ProductEvent, userId: string, properties: Record<string, unknown>, key: string) {
  const response = await fetch(CAPTURE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: key, event, distinct_id: userId, properties, timestamp: new Date().toISOString() }),
  });
  if (!response.ok) throw new Error(`PostHog answered ${response.status}`);
}

/**
 * A product milestone, sent from the server so ad blockers can't hide it.
 * Keyed by the seller's id; never the email, the name, or anything about a prospect.
 * No-op without a PostHog key (dev, tests).
 */
export function captureProductEvent(event: ProductEvent, userId: string, properties: Record<string, unknown> = {}) {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key) return;
  const task = () => send(event, userId, properties, key).catch((error) => console.error(`[analytics:${event}]`, error));
  try {
    after(task);
  } catch {
    // Outside a request (a background job): no response to wait for
    void task();
  }
}
