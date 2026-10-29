"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAppOrigin } from "@/lib/app-origin";
import { checkoutOffer } from "@/lib/billing/offers";
import {
  BILLING_HREF,
  isPaidPlanId,
  isPaidStatus,
  mailboxItemOf,
  mailboxLookupKeyFor,
  planItemOf,
  seatQuantity,
  type Interval,
} from "@/lib/billing/plans";
import { getStripe, resolvePortalConfiguration, resolvePrice, resolvePriceByKey } from "@/lib/billing/stripe";
import { syncSubscription } from "@/lib/billing/webhook";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/session";

export type BillingState = { error?: string } | null;

// Back from Stripe on the billing section; ?billing=success shows the "activating" state
const [BILLING_PATH, BILLING_ANCHOR] = BILLING_HREF.split("#");

// Stripe pages in the seller's UI language
async function stripeLocale() {
  return (await getLocale()) === "fr" ? "fr" : "en";
}

/** The Stripe customer for this workspace, created once (the idempotency key covers double clicks). */
async function ensureCustomer(organizationId: string, name: string, email: string) {
  const stripe = getStripe()!;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { stripeCustomerId: true } });
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const customer = await stripe.customers.create(
    { name, email, preferred_locales: [await stripeLocale()], metadata: { organizationId } },
    { idempotencyKey: `customer-${organizationId}` },
  );
  await prisma.organization.update({ where: { id: organizationId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

export async function startCheckout(plan: string, interval: Interval): Promise<BillingState> {
  const { user, organization } = await requireManager();
  const t = await getTranslations("billing.errors");
  const stripe = getStripe();
  if (!stripe) return { error: t("disabled") };
  if (!isPaidPlanId(plan) || (interval !== "month" && interval !== "year")) return { error: t("generic") };

  // Already subscribed: changes happen in the portal, never a second subscription (it redirects there)
  if (isPaidStatus(organization.planStatus) && organization.stripeSubscriptionId) {
    return openBillingPortal();
  }
  const members = await prisma.member.count({ where: { organizationId: organization.id } });
  if (plan === "solo" && members > 1) return { error: t("soloTeam") };

  const offer = checkoutOffer(organization, new Date(), interval);
  let url: string | null;
  try {
    const origin = await getAppOrigin();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: await ensureCustomer(organization.id, organization.name, user.email),
      client_reference_id: organization.id,
      line_items: [{ price: await resolvePrice(stripe, plan, interval), quantity: plan === "team" ? seatQuantity(members) : 1 }],
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      customer_update: { address: "auto", name: "auto" },
      billing_address_collection: "required",
      // Stripe refuses a coupon together with promotion codes.
      ...(offer ? { discounts: [{ coupon: offer.couponId }] } : { allow_promotion_codes: true }),
      // The plan too: read back if this price is ever replaced and loses its lookup key
      subscription_data: {
        metadata: { organizationId: organization.id, plan },
        ...(offer?.trialEnd ? { trial_end: offer.trialEnd } : {}),
      },
      locale: await stripeLocale(),
      success_url: `${origin}${BILLING_PATH}?billing=success#${BILLING_ANCHOR}`,
      cancel_url: `${origin}${BILLING_HREF}`,
    });
    url = session.url;
  } catch (error) {
    console.error("[billing:checkout]", error);
    return { error: t("generic") };
  }
  if (!url) return { error: t("generic") };
  redirect(url);
}

export async function openBillingPortal(): Promise<BillingState> {
  const { organization } = await requireManager();
  const t = await getTranslations("billing.errors");
  const stripe = getStripe();
  if (!stripe) return { error: t("disabled") };
  if (!organization.stripeCustomerId) return { error: t("noCustomer") };

  let url: string;
  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      configuration: await resolvePortalConfiguration(stripe, organization.plan),
      return_url: `${await getAppOrigin()}${BILLING_HREF}`,
      locale: await stripeLocale(),
    });
    url = session.url;
  } catch (error) {
    console.error("[billing:portal]", error);
    return { error: t("generic") };
  }
  redirect(url);
}

/**
 * Solo to Team from Clozer, not the portal: the portal only knows the price per seat, Clozer
 * shows what is really billed (every member, 2 minimum). The difference is charged at once.
 */
export async function switchToTeam(interval: Interval): Promise<BillingState & { ok?: boolean }> {
  const { organization } = await requireManager();
  const t = await getTranslations("billing.errors");
  const stripe = getStripe();
  if (!stripe) return { error: t("disabled") };
  if (interval !== "month" && interval !== "year") return { error: t("generic") };
  if (organization.plan !== "solo" || !isPaidStatus(organization.planStatus) || !organization.stripeSubscriptionId) {
    return { error: t("generic") };
  }

  try {
    const members = await prisma.member.count({ where: { organizationId: organization.id } });
    const subscription = await stripe.subscriptions.retrieve(organization.stripeSubscriptionId);
    const item = planItemOf(subscription);
    if (!item) return { error: t("generic") };
    // The mailbox add-on follows the plan's interval: Stripe refuses mixed intervals on one subscription
    const mailboxItem = mailboxItemOf(subscription);
    const items = [{ id: item.id, price: await resolvePrice(stripe, "team", interval), quantity: seatQuantity(members) }];
    if (mailboxItem) {
      items.push({
        id: mailboxItem.id,
        price: await resolvePriceByKey(stripe, mailboxLookupKeyFor(interval)),
        quantity: mailboxItem.quantity ?? 1,
      });
    }
    await stripe.subscriptions.update(subscription.id, {
      items,
      proration_behavior: "always_invoice",
      // A declined card leaves the subscription on Solo instead of a Team left unpaid
      payment_behavior: "error_if_incomplete",
      metadata: { ...subscription.metadata, plan: "team" },
    });
    // The webhook says the same a moment later; the page should not wait for it
    await syncSubscription(stripe, subscription.id);
  } catch (error) {
    console.error("[billing:switch-team]", error);
    return { error: t("switchFailed") };
  }
  revalidatePath("/settings");
  return { ok: true };
}
