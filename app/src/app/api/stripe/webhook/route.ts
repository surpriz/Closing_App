import { getStripe } from "@/lib/billing/stripe";
import { handleStripeEvent } from "@/lib/billing/webhook";
import { getEnv } from "@/lib/env";

// Stripe signs the raw body: read it as text, never parsed first
export async function POST(request: Request) {
  const stripe = getStripe();
  const secret = getEnv().STRIPE_WEBHOOK_SECRET;
  if (!stripe || !secret) return Response.json({ error: "billing_disabled" }, { status: 404 });

  const body = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, request.headers.get("stripe-signature") ?? "", secret);
  } catch {
    return Response.json({ error: "bad_signature" }, { status: 400 });
  }
  return handleStripeEvent(stripe, event);
}
