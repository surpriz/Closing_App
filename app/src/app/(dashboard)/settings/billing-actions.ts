"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAppOrigin } from "@/lib/app-origin";
import { BILLING_HREF, isPaidPlanId, isPaidStatus, seatQuantity, type Interval } from "@/lib/billing/plans";
import { getStripe, resolvePortalConfiguration, resolvePrice } from "@/lib/billing/stripe";
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
      allow_promotion_codes: true,
      // The plan too: read back if this price is ever replaced and loses its lookup key
      subscription_data: { metadata: { organizationId: organization.id, plan } },
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
