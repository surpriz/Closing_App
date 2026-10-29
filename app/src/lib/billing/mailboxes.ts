import type Stripe from "stripe";

import { prisma } from "@/lib/db";

import {
  PAID_STATUSES,
  PLANS,
  billableMailboxes,
  isPaidPlanId,
  isPaidStatus,
  mailboxItemOf,
  mailboxLookupKeyFor,
  planFromLookupKey,
  planItemOf,
  type Interval,
  type SubscriptionLike,
} from "./plans";
import { getStripe, resolvePriceByKey } from "./stripe";
import { PlanLimitError, getWorkspacePlan } from "./workspace-plan";

/** The few Stripe calls used, so tests need no SDK. The real client is assignable to it. */
export type StripeForMailboxes = {
  subscriptions: { retrieve(id: string): Promise<SubscriptionLike & { id: string }> };
  subscriptionItems: {
    create(params: { subscription: string; price: string; quantity: number; proration_behavior: "always_invoice" }): Promise<unknown>;
    update(id: string, params: { price?: string; quantity: number; proration_behavior: "always_invoice" }): Promise<unknown>;
    del(id: string, params: { proration_behavior: "always_invoice" }): Promise<unknown>;
  };
  prices: { list(params: { lookup_keys: string[]; active: boolean; limit: number }): Promise<{ data: { id: string }[] }> };
};

export type MailboxSyncResult = "skipped" | "unchanged" | "added" | "updated" | "removed";

/** Mailboxes that count for billing: everything not disconnected (errors included, the seller still holds the slot). */
export function countBillableMailboxes(organizationId: string) {
  return prisma.mailbox.count({ where: { organizationId, status: { not: "DISCONNECTED" } } });
}

/** Free has no mailbox add-on: connecting one needs a plan that sells it. */
export async function canUseMailboxes(organizationId: string) {
  return (await getWorkspacePlan(organizationId)).limits.mailboxAddon;
}

export async function assertCanConnectMailbox(organizationId: string) {
  if (!(await canUseMailboxes(organizationId))) throw new PlanLimitError("mailbox");
}

/**
 * Keeps the subscription's mailbox item on the number of connected mailboxes over what the plan includes, settled at
 * once both ways. Only a paid Stripe subscription carries it; the webhook then writes `mailboxQuantity`.
 */
export async function syncMailboxQuantity(
  organizationId: string,
  deps: { stripe?: StripeForMailboxes | null } = {},
): Promise<MailboxSyncResult> {
  const stripe = deps.stripe ?? (getStripe() as StripeForMailboxes | null);
  if (!stripe) return "skipped";
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, planStatus: true, stripeSubscriptionId: true, billingInterval: true, mailboxQuantity: true },
  });
  if (!org?.stripeSubscriptionId || !isPaidStatus(org.planStatus) || !isPaidPlanId(org.plan)) return "skipped";

  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  // Counted after the retrieve: narrows the window in which a concurrent sync could write a stale quantity
  const quantity = billableMailboxes(await countBillableMailboxes(organizationId), PLANS[org.plan]);
  // Matched by lookup key: an item left on a price whose key moved elsewhere would not be found. Keep the keys on
  // the same price when amounts change (stripe-setup uses transfer_lookup_key, which moves the key with the price)
  const item = mailboxItemOf(subscription);
  const interval: Interval = planFromLookupKey(planItemOf(subscription)?.price.lookup_key)?.interval ?? asInterval(org.billingInterval);
  const key = mailboxLookupKeyFor(interval);

  let result: MailboxSyncResult;
  if (item && quantity === 0) {
    await stripe.subscriptionItems.del(item.id as string, { proration_behavior: "always_invoice" });
    result = "removed";
  } else if (!item && quantity > 0) {
    const price = await resolvePriceByKey(stripe as unknown as Stripe, key);
    // No idempotency key: Stripe replays it for 24 h, so delete then re-add would get the deleted item back
    await stripe.subscriptionItems.create({ subscription: subscription.id, price, quantity, proration_behavior: "always_invoice" });
    result = "added";
  } else if (item && (item.quantity !== quantity || item.price.lookup_key !== key)) {
    // A plan switched month <-> year in the portal leaves the add-on on the old interval: move it too
    const price = item.price.lookup_key !== key ? await resolvePriceByKey(stripe as unknown as Stripe, key) : undefined;
    await stripe.subscriptionItems.update(item.id as string, {
      ...(price ? { price } : {}),
      quantity,
      proration_behavior: "always_invoice",
    });
    result = "updated";
  } else {
    // Stripe already holds the right value: only the mirror may be stale, and reconcile would flag it forever
    const held = item?.quantity ?? null;
    if (held !== org.mailboxQuantity) await prisma.organization.update({ where: { id: organizationId }, data: { mailboxQuantity: held } });
    return "unchanged";
  }
  // Optimistic mirror of what the webhook will write (null once the item is gone)
  await prisma.organization.update({ where: { id: organizationId }, data: { mailboxQuantity: quantity > 0 ? quantity : null } });
  return result;
}

function asInterval(value: string | null | undefined): Interval {
  return value === "year" ? "year" : "month";
}

/** Safety net from the engine tick: paid subscriptions whose mailbox item drifted from the connected mailboxes. */
export async function reconcileMailboxes(limit = 20) {
  if (!getStripe()) return 0;
  const orgs = await prisma.organization.findMany({
    where: { plan: { in: ["solo", "team"] }, stripeSubscriptionId: { not: null }, planStatus: { in: [...PAID_STATUSES] } },
    select: {
      id: true,
      plan: true,
      mailboxQuantity: true,
      _count: { select: { mailboxes: { where: { status: { not: "DISCONNECTED" } } } } },
    },
  });
  const drifted = orgs
    .filter((org) => isPaidPlanId(org.plan) && (org.mailboxQuantity ?? 0) !== billableMailboxes(org._count.mailboxes, PLANS[org.plan]))
    .slice(0, limit);
  for (const org of drifted) {
    await syncMailboxQuantity(org.id).catch((error) => console.error("[billing:mailboxes]", org.id, error));
  }
  return drifted.length;
}
