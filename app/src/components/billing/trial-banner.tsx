import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BILLING_HREF, bannerFor, type EffectivePlan } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

/** Under the header: a payment to fix, or a trial, beta or plan ending within the week. */
export async function TrialBanner({ plan, now, offer }: { plan: EffectivePlan; now: Date; offer: boolean }) {
  const banner = bannerFor(plan, now);
  if (!banner) return null;
  const t = await getTranslations("billing.banner");
  const days = banner.daysLeft ?? 0;
  const message =
    banner.kind === "payment" ? t("payment") : offer && banner.kind === "trial" ? t("offer", { days }) : t(banner.kind, { days });

  return (
    <div className={cn("border-b border-foreground", banner.kind === "payment" ? "bg-destructive/10" : "bg-warning/15")}>
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-2 text-small sm:px-6">
        <span>{message}</span>
        <Link href={BILLING_HREF} className="font-medium underline underline-offset-4">
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
