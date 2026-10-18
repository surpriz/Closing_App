import { revalidatePath } from "next/cache";
import type Stripe from "stripe";

import { isUniqueViolation } from "@/lib/closing/followups/queue";
import { prisma } from "@/lib/db";

import { seatQuantity, subscriptionFields } from "./plans";
import { syncSeats } from "./seats";
import { sendPaymentFailedEmail } from "./send-emails";

const idOf = (value: string | { id: string } | null | undefined) => (typeof value === "string" ? value : (value?.id ?? null));

async function orgIdForCustomer(customer: string | { id: string } | null | undefined) {
  const customerId = idOf(customer);
  if (!customerId) return null;
  const org = await prisma.organization.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
  return org?.id ?? null;
}

/** Writes the subscription as Stripe has it now: whatever order events arrive in, the latest state wins. */
async function syncSubscription(stripe: Stripe, subscriptionId: string) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const organizationId = subscription.metadata.organizationId || (await orgIdForCustomer(subscription.customer));
  if (!organizationId) {
    console.warn("[billing] subscription without a workspace", subscription.id);
    return null;
  }

  const fields = subscriptionFields(subscription);
  const org = await prisma.organization.update({
    where: { id: organizationId },
    data: { ...fields, stripeCustomerId: idOf(subscription.customer) },
    select: { _count: { select: { members: true } } },
  });
  // Switched from Solo to Team in the portal: one seat billed, bring it to the member count
  if (fields.plan === "team" && fields.seats !== seatQuantity(org._count.members)) await syncSeats(organizationId);
  return organizationId;
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
