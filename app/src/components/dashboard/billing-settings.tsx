"use client";

import { Check } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { openBillingPortal, startCheckout, switchToTeam, type BillingState } from "@/app/(dashboard)/settings/billing-actions";
import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MONTHLY_PRICE_CENTS, PLANS, seatQuantity, type Interval, type PaidPlanId, type PlanId, type PlanSource } from "@/lib/billing/plans";
import { cn } from "@/lib/utils";

type Usage = { used: number; max: number | null };

export type BillingSettingsProps = {
  plan: PlanId;
  source: PlanSource;
  endsAt: string | null;
  paymentIssue: boolean;
  subscribed: PlanId | null;
  periodEnd: string | null;
  interval: Interval | null;
  seats: number | null;
  members: number;
  usage: { links: Usage; aiFollowups: Usage; videoPitches: Usage };
  canManage: boolean;
  billingEnabled: boolean;
  hasCustomer: boolean;
  /** Campaign discount still to take: the date it lapses. */
  offerEndsAt: string | null;
};

// Same inbox as the landing (landing/src/components/links.ts)
const CONTACT_EMAIL = "contact@clozer.club";

const FEATURES = {
  free: ["links", "tracking", "followups", "extension"],
  solo: ["links", "followups", "assistant", "branding"],
  team: ["solo", "teamView", "integrations", "seats"],
} as const;

function report(result: BillingState | undefined) {
  if (result?.error) toast.error(result.error);
}

export function BillingSettings(props: BillingSettingsProps) {
  const t = useTranslations("billing");
  const format = useFormatter();
  const locale = useLocale();
  const params = useSearchParams();
  const [interval, setInterval] = useState<Interval>(props.interval ?? "year");
  const [pending, startTransition] = useTransition();
  const [confirmTeam, setConfirmTeam] = useState(false);
  const toasted = useRef(false);
  const justPaid = params.get("billing") === "success";
  const activating = justPaid && props.subscribed === null;

  useEffect(() => {
    if (justPaid && !toasted.current) {
      toasted.current = true;
      toast.success(t("checkout.success"));
    }
  }, [justPaid, t]);

  const money = (cents: number) =>
    new Intl.NumberFormat(locale, { style: "currency", currency: "EUR", maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);
  const date = (iso: string | null) => (iso ? format.dateTime(new Date(iso), { day: "numeric", month: "long", year: "numeric" }) : "");

  const status = (() => {
    if (props.source === "unbilled") return t("current.unbilled");
    if (props.source === "trial") return t("current.trial", { date: date(props.endsAt) });
    if (props.source === "beta") return props.endsAt ? t("current.betaUntil", { date: date(props.endsAt) }) : t("current.beta");
    if (props.source === "comped") return t("current.comped");
    if (props.source === "subscription") {
      return props.endsAt ? t("current.canceling", { date: date(props.endsAt) }) : t("current.subscription", { date: date(props.periodEnd) });
    }
    return t("current.free");
  })();

  const usageLine = ({ used, max }: Usage) => (max === null ? t("usage.unlimited", { used }) : t("usage.of", { used, max }));
  // Solo already paid: the move to Team happens here, with the real amount, not in the portal
  const soloSubscriber = props.subscribed === "solo" && props.source !== "comped";
  const choose = (plan: PaidPlanId) =>
    plan === "team" && soloSubscriber
      ? setConfirmTeam(true)
      : startTransition(async () => report(await startCheckout(plan, interval)));
  const teamSeats = seatQuantity(props.members);
  const teamMonthly = MONTHLY_PRICE_CENTS.team[interval];
  const moveToTeam = () =>
    startTransition(async () => {
      const result = await switchToTeam(interval);
      setConfirmTeam(false);
      if (result.ok) toast.success(t("switch.done"));
      else report(result);
    });
  const manage = () => startTransition(async () => report(await openBillingPortal()));

  return (
    <section id="facturation" className="max-w-2xl scroll-mt-24 space-y-3">
      {activating && <AutoRefresh intervalMs={3000} />}
      <div className="space-y-1">
        <h2 className="text-heading">{t("title")}</h2>
        <p className="text-body text-muted-foreground">{t("description")}</p>
      </div>

      <div className="divide-y divide-border border-y border-foreground bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
          <div className="space-y-1">
            <p className="text-small text-muted-foreground">{t("current.label")}</p>
            <p className="text-body font-medium">
              {t(`plans.${props.plan}.name`)}
              {props.plan === "team" && props.seats ? ` · ${t("current.seats", { count: props.seats })}` : ""}
            </p>
            <p className="text-small text-muted-foreground">{activating ? t("checkout.pending") : status}</p>
            {props.paymentIssue && <p className="text-small text-destructive">{t("current.paymentIssue")}</p>}
          </div>
          {props.canManage && props.hasCustomer && props.billingEnabled && (
            <Button variant="outline" size="sm" disabled={pending} onClick={manage}>
              {pending ? t("actions.redirecting") : t("actions.manage")}
            </Button>
          )}
        </div>

        <div className="space-y-2 px-5 py-4">
          <p className="text-small text-muted-foreground">{t("usage.title")}</p>
          <dl className="grid gap-x-6 gap-y-1 text-body sm:grid-cols-3">
            {(["links", "aiFollowups", "videoPitches"] as const).map((key) => (
              <div key={key}>
                <dt className="text-small text-muted-foreground">{t(`usage.${key}`)}</dt>
                <dd className="tabular-nums">{usageLine(props.usage[key])}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {props.billingEnabled && (
        <div className="space-y-3 pt-2">
          {props.offerEndsAt && <p className="text-small font-medium">{t("offer.line", { date: date(props.offerEndsAt) })}</p>}
          <div role="group" aria-label={t("interval.label")} className="inline-flex rounded-lg border border-input p-0.5 text-small">
            {(["month", "year"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={interval === value}
                onClick={() => setInterval(value)}
                className={cn("rounded-md px-3 py-1", interval === value ? "bg-foreground text-background" : "text-muted-foreground")}
              >
                {t(`interval.${value}`)}
                {value === "year" && <span className="ml-1 opacity-80">· {t("interval.save")}</span>}
              </button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(["free", "solo", "team"] as const).map((plan) => {
              const cents = plan === "free" ? 0 : MONTHLY_PRICE_CENTS[plan][interval];
              const isCurrent = (props.subscribed ?? "free") === plan && (props.source === "subscription" || props.source === "free");
              const quantity = plan === "team" ? seatQuantity(props.members) : 1;
              return (
                <div key={plan} className={cn("flex flex-col gap-3 border border-border bg-card p-4", isCurrent && "border-foreground")}>
                  <div className="space-y-1">
                    <p className="text-body font-medium">{t(`plans.${plan}.name`)}</p>
                    <p className="text-small text-muted-foreground">{t(`plans.${plan}.tagline`)}</p>
                  </div>
                  <div>
                    <p className="text-heading tabular-nums">
                      {plan === "team" ? t("price.perSeat", { amount: money(cents) }) : t("price.perMonth", { amount: money(cents) })}
                    </p>
                    {plan === "solo" && (
                      <p className="text-small text-muted-foreground">
                        {t("price.exclVat")}
                        {interval === "year" && ` · ${t("price.billedYearly", { amount: money(cents * 12) })}`}
                      </p>
                    )}
                    {plan === "team" && (
                      <p className="text-small text-muted-foreground">
                        {t("price.exclVat")} ·{" "}
                        {t("price.teamTotal", {
                          amount: money(cents * quantity * (interval === "year" ? 12 : 1)),
                          period: interval,
                          count: quantity,
                        })}
                        {props.members < quantity && ` (${t("price.teamMinimum")})`}
                      </p>
                    )}
                  </div>
                  <ul className="flex-1 space-y-1 text-small">
                    {FEATURES[plan].map((feature) => (
                      <li key={feature} className="flex gap-1.5">
                        <Check className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                        {t(`plans.${plan}.features.${feature}` as never)}
                      </li>
                    ))}
                  </ul>
                  {plan !== "free" &&
                    (isCurrent ? (
                      <p className="text-small text-muted-foreground">{t("actions.current")}</p>
                    ) : (
                      <Button
                        size="sm"
                        variant={plan === "team" ? "default" : "outline"}
                        disabled={!props.canManage || pending || PLANS[plan].rank < PLANS[props.subscribed ?? "free"].rank}
                        onClick={() => choose(plan)}
                      >
                        {t("actions.choose", { plan: t(`plans.${plan}.name`) })}
                      </Button>
                    ))}
                </div>
              );
            })}
          </div>

          <p className="text-small text-muted-foreground">
            {t("plans.enterprise.name")} · {t("plans.enterprise.tagline")}{" "}
            <a
              className="underline"
              href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t("plans.enterprise.mailSubject"))}`}
            >
              {t("plans.enterprise.cta")}
            </a>
          </p>
          {!props.canManage && <p className="text-small text-muted-foreground">{t("actions.managerOnly")}</p>}
        </div>
      )}
      <Dialog open={confirmTeam} onOpenChange={setConfirmTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("switch.title")}</DialogTitle>
            <DialogDescription>
              {t("switch.body", {
                count: teamSeats,
                price: money(teamMonthly),
                period: interval,
                total: money(teamMonthly * teamSeats * (interval === "year" ? 12 : 1)),
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>{t("switch.cancel")}</DialogClose>
            <Button disabled={pending} onClick={moveToTeam}>
              {t("switch.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
