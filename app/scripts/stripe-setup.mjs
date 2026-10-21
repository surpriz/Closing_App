// Creates the Stripe catalogue Clozer bills from, once per mode (test, then live). Safe to run again.
//   STRIPE_SECRET_KEY=sk_test_… node scripts/stripe-setup.mjs
// The app finds prices by lookup key (src/lib/billing/plans.ts): a new amount is a new price
// created here with the same lookup key (transfer_lookup_key), no deploy needed.
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is missing");
  process.exit(1);
}
const stripe = new Stripe(key);

// SaaS, business use. Amounts in euro cents excl. VAT; yearly = 12 × the yearly monthly rate
const TAX_CODE = "txcd_10103001";
const CATALOGUE = [
  {
    plan: "solo",
    name: "Clozer Solo",
    prices: [
      { lookupKey: "clozer_solo_monthly", interval: "month", amount: 1900 },
      { lookupKey: "clozer_solo_yearly", interval: "year", amount: 18000 },
    ],
  },
  {
    plan: "team",
    name: "Clozer Team",
    unitLabel: "seat",
    prices: [
      { lookupKey: "clozer_team_monthly", interval: "month", amount: 3900 },
      { lookupKey: "clozer_team_yearly", interval: "year", amount: 38400 },
    ],
  },
];

async function ensureProduct({ plan, name, unitLabel }) {
  const { data } = await stripe.products.search({ query: `metadata['clozer_plan']:'${plan}' AND active:'true'` });
  if (data[0]) return data[0];
  return stripe.products.create({ name, tax_code: TAX_CODE, unit_label: unitLabel, metadata: { clozer_plan: plan } });
}

async function ensurePrice(product, { lookupKey, interval, amount }) {
  const { data } = await stripe.prices.list({ lookup_keys: [lookupKey], active: true, limit: 1 });
  const current = data[0];
  if (current && current.unit_amount === amount && current.product === product.id) return current;
  return stripe.prices.create({
    product: product.id,
    currency: "eur",
    unit_amount: amount,
    recurring: { interval },
    tax_behavior: "exclusive",
    lookup_key: lookupKey,
    transfer_lookup_key: !!current,
  });
}

const portalProducts = [];
for (const entry of CATALOGUE) {
  const product = await ensureProduct(entry);
  const prices = [];
  for (const price of entry.prices) prices.push((await ensurePrice(product, price)).id);
  portalProducts.push({ product: product.id, prices });
  console.log(`${entry.name}: ${product.id} · ${prices.join(", ")}`);
}

// Two portals. Solo can move up to Team; Team only changes period or cancels: a Solo price
// on a workspace of several members would bill one seat for a team (lib/billing/stripe.ts picks one).
// Seats follow the members (lib/billing/seats.ts): no quantity change in either.
const [solo, team] = portalProducts;
const portal = (kind, products) => ({
  business_profile: { headline: "Clozer" },
  metadata: { clozer_portal: kind },
  features: {
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    customer_update: { enabled: true, allowed_updates: ["address", "tax_id", "email", "name"] },
    subscription_cancel: { enabled: true, mode: "at_period_end", cancellation_reason: { enabled: true, options: ["too_expensive", "missing_features", "unused", "switched_service", "other"] } },
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      proration_behavior: "create_prorations",
      products,
    },
  },
});
const { data: configurations } = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
for (const [kind, products] of [["solo", [solo, team]], ["team", [team]]]) {
  const existing = configurations.find((configuration) => configuration.metadata?.clozer_portal === kind);
  const configuration = existing
    ? await stripe.billingPortal.configurations.update(existing.id, portal(kind, products))
    : await stripe.billingPortal.configurations.create(portal(kind, products));
  console.log(`Customer portal (${kind}): ${configuration.id}`);
}
console.log("Then: Stripe Tax origin address and registrations, webhook endpoint /api/stripe/webhook");
