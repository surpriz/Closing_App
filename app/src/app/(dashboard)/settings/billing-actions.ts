"use server";

import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { getAppOrigin } from "@/lib/app-origin";
import { PAID_STATUSES, isPaidPlanId, seatQuantity, type Interval } from "@/lib/billing/plans";
import { getStripe, resolvePrice } from "@/lib/billing/stripe";
import { prisma } from "@/lib/db";
import { requireManager } from "@/lib/session";

export type BillingState = { error?: string } | null;

const BILLING_PATH = "/settings";

/** The Stripe customer for this workspace, created once (the idempotency key covers double clicks). */
async function ensureCustomer(organizationId: string, name: string, email: string) {
  const stripe = getStripe()!;
  const org = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { stripeCustomerId: true } });
  if (org.stripeCustomerId) return org.stripeCustomerId;
  const customer = await stripe.customers.create(
    { name, email, preferred_locales: [await getLocale()], metadata: { organizationId } },
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

  // Already subscribed: changes happen in the portal, never a second subscription
  if ((PAID_STATUSES as readonly (string | null)[]).includes(organization.planStatus) && organization.stripeSubscriptionId) {
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
      subscription_data: { metadata: { organizationId: organization.id } },
      locale: (await getLocale()) === "fr" ? "fr" : "en",
      success_url: `${origin}${BILLING_PATH}?billing=success#facturation`,
      cancel_url: `${origin}${BILLING_PATH}#facturation`,
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
      return_url: `${await getAppOrigin()}${BILLING_PATH}#facturation`,
      locale: (await getLocale()) === "fr" ? "fr" : "en",
    });
    url = session.url;
  } catch (error) {
    console.error("[billing:portal]", error);
    return { error: t("generic") };
  }
  redirect(url);
}
