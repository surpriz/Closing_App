import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { captureProductEvent } from "@/lib/analytics/server";
import { isUniqueViolation } from "@/lib/closing/followups/queue";
import { prisma } from "@/lib/db";

import { isPaidStatus, seatQuantity, subscriptionFields } from "./plans";
import { syncSeats } from "./seats";
import { sendPaymentFailedEmail } from "./send-emails";

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

async function orgIdForCustomer(customer: string | { id: string } | null | undefined) {
  const customerId = idOf(customer);
  if (!customerId) return null;
  const org = await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
  return org?.id ?? null;
}

const ORG_BILLING = {
  id: true,
  plan: true,
  planStatus: true,
  stripeSubscriptionId: true,
  _count: { select: { members: true } },
} as const;

/** Writes the subscription as Stripe has it now: whatever order events arrive in, the latest state wins. */
export async function syncSubscription(stripe: Stripe, subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const customerId = idOf(subscription.customer);
  // The workspace may be gone (deleted, which cancelled the subscription): nothing to write, no retry
  const org =
    (subscription.metadata.organizationId &&
      (await prisma.organization.findUnique({ where: { id: subscription.metadata.organizationId }, select: ORG_BILLING }))) ||
    (customerId && (await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: ORG_BILLING })));
  if (!org) {
    console.warn("[billing] subscription without a workspace", subscription.id);
    return null;
  }

  // A late event about an old subscription must not overwrite the one now paid for
  const replaced =
    org.stripeSubscriptionId && org.stripeSubscriptionId !== subscription.id && isPaidStatus(org.planStatus);
  if (replaced && !isPaidStatus(subscription.status)) return org.id;

  const fields = subscriptionFields(subscription, org.plan);
  await prisma.organization.update({ where: { id: org.id }, data: { ...fields, stripeCustomerId: customerId } });
  if (fields.plan !== org.plan || isPaidStatus(fields.planStatus) !== isPaidStatus(org.planStatus)) {
    const owner = await prisma.member.findFirst({
      where: { organizationId: org.id, role: { contains: "owner" } },
      select: { userId: true },
    });
    if (owner) {
      captureProductEvent("plan_changed", owner.userId, {
        plan: fields.plan,
        previous_plan: org.plan,
        status: fields.planStatus,
        interval: fields.billingInterval,
        seats: fields.seats,
      });
    }
  }
  // Switched from Solo to Team in the portal: one seat billed, bring it to the member count
  if (fields.plan === "team" && fields.seats !== seatQuantity(org._count.members)) await syncSeats(org.id);
  return org.id;
}

async function handle(stripe: Stripe, event: Stripe.Event): Promise<string | null> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const subscriptionId = idOf(session.subscription);
      if (session.client_reference_id && session.customer) {
        await prisma.organization.updateMany({
          where: { id: session.client_reference_id, stripeCustomerId: null },
          data: { stripeCustomerId: idOf(session.customer) },
        });
      }
      return subscriptionId ? syncSubscription(stripe, subscriptionId) : session.client_reference_id;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      return syncSubscription(stripe, event.data.object.id);
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const organizationId = await orgIdForCustomer(invoice.customer);
      if (organizationId) {
        await prisma.organization.update({ where: { id: organizationId }, data: { paymentFailedAt: new Date() } });
        // Stripe's own retries come with new events: one email per invoice
        if (invoice.id) {
          await sendPaymentFailedEmail(organizationId, invoice.id).catch((error) => console.error("[billing:payment-email]", error));
        }
      }
      return organizationId;
    }
    case "invoice.paid": {
      const organizationId = await orgIdForCustomer(event.data.object.customer);
      if (organizationId) await prisma.organization.update({ where: { id: organizationId }, data: { paymentFailedAt: null } });
      return organizationId;
    }
    default:
      return null;
  }
}

/**
 * Stripe delivers at least once: the event is claimed first, a replay is a
 * no-op. On failure the claim is released and Stripe retries.
 */
export async function handleStripeEvent(stripe: Stripe, event: Stripe.Event) {
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch (error) {
    if (isUniqueViolation(error)) return Response.json({ received: true, duplicate: true });
    throw error;
  }

  try {
    const organizationId = await handle(stripe, event);
    if (organizationId) {
      await prisma.stripeEvent.update({ where: { id: event.id }, data: { organizationId } });
      revalidatePath("/", "layout");
    }
    return Response.json({ received: true });
  } catch (error) {
    console.error("[billing:webhook]", event.type, event.id, error);
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    return Response.json({ error: "handler_failed" }, { status: 500 });
  }
}
