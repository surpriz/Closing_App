import type { Money } from "@/lib/closing/dashboard/team";

/** "12 500 € · 3 000 $US", or null when no deal had an amount. */
export function formatMoney(money: Money) {
  const parts = Object.entries(money).map(([currency, cents]) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100),
  );
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** Sums several sellers' amounts, currency by currency. */
export function sumMoney(amounts: Money[]) {
  const total: Money = {};
  for (const money of amounts) {
    for (const [currency, cents] of Object.entries(money)) total[currency] = (total[currency] ?? 0) + cents;
  }
  return total;
}
