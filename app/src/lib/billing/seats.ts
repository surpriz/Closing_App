import { prisma } from "@/lib/db";

import { PAID_STATUSES, seatQuantity } from "./plans";
import { getStripe } from "./stripe";

/**
 * Team is billed per member: keeps the subscription quantity on the member
 * count (never under the minimum), prorated. The webhook then writes `seats`.
 */
export async function syncSeats(organizationId: string) {
  const stripe = getStripe();
  if (!stripe) return;
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, planStatus: true, stripeSubscriptionId: true, seats: true, _count: { select: { members: true } } },
  });
  if (!org?.stripeSubscriptionId || org.plan !== "team") return;
  if (!(PAID_STATUSES as readonly (string | null)[]).includes(org.planStatus)) return;

  const quantity = seatQuantity(org._count.members);
  if (quantity === org.seats) return;
  const subscription = await stripe.subscriptions.retrieve(org.stripeSubscriptionId);
  const item = subscription.items.data[0];
  if (!item || item.quantity === quantity) return;
  await stripe.subscriptions.update(subscription.id, {
    items: [{ id: item.id, quantity }],
    proration_behavior: "create_prorations",
  });
}

/** Safety net from the engine tick: Team subscriptions whose seats drifted from the member count. */
export async function reconcileSeats(limit = 20) {
  if (!getStripe()) return;
  const orgs = await prisma.organization.findMany({
    where: { plan: "team", stripeSubscriptionId: { not: null }, planStatus: { in: [...PAID_STATUSES] } },
    select: { id: true, seats: true, _count: { select: { members: true } } },
  });
  const drifted = orgs.filter((org) => org.seats !== seatQuantity(org._count.members)).slice(0, limit);
  for (const org of drifted) {
    await syncSeats(org.id).catch((error) => console.error("[billing:seats]", org.id, error));
  }
}
