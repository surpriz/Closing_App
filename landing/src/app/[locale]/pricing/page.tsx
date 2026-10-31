import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { BillingToggle } from "@/components/billing-toggle";
import { Icon } from "@/components/icons";
import { APP_BILLING_URL, CONTACT_EMAIL, appUrl } from "@/components/links";
import { SignupForm } from "@/components/signup-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HeatScale } from "@/components/thermal-plate";
import { COMPARISON, MAILBOX_MONTHLY_PRICE, MONTHLY_PRICE, PLAN_KEYS, euros, type Interval, type PaidPlanKey } from "@/content/pricing";
import { MESSAGES } from "@/i18n/messages";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/page";
import { alternatesFor, localizedPath } from "@/i18n/seo";

const FAQ = ["vat", "cancel", "members", "coldEmail", "afterTrial", "beta", "invoices", "payment", "security"] as const;
const INTERVALS = ["month", "year"] as const;

// Hidden unless the toggle (components/billing-toggle.tsx) is on that interval; monthly by default.
const SHOW: Record<Interval, string> = {
  month: "group-data-[interval=year]/billing:hidden",
  year: "hidden group-data-[interval=year]/billing:block",
};

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "pricing" });
  const title = `Clozer · ${t("title")}`;
  return {
    title,
    description: t("description"),
    alternates: alternatesFor(locale, "/pricing"),
    openGraph: { title, description: t("description"), url: localizedPath(locale, "/pricing") },
    twitter: { title, description: t("description") },
  };
}

const WRAP = "mx-auto w-full max-w-[90rem] px-5 sm:px-8";

export default async function Pricing({ params }: Props) {
  const locale = await resolveLocale(params);
  const [t, th, ts] = await Promise.all([
    getTranslations({ locale, namespace: "pricing" }),
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "signup" }),
  ]);

  const billingLink = (chunks: React.ReactNode) => (
    <a href={APP_BILLING_URL} className="font-medium text-ink underline underline-offset-4">
      {chunks}
    </a>
  );

  const securityLink = (chunks: React.ReactNode) => (
    <Link href="/security" className="font-medium text-ink underline underline-offset-4">
      {chunks}
    </Link>
  );
  const dpaLink = (chunks: React.ReactNode) => (
    <Link href="/dpa" className="font-medium text-ink underline underline-offset-4">
      {chunks}
    </Link>
  );

  // A price block for the toggle: both intervals in the HTML, SHOW reveals one. The add-on reuses it.
  const price = (key: PaidPlanKey | "addon") => {
    const amounts = key === "addon" ? MAILBOX_MONTHLY_PRICE : MONTHLY_PRICE[key];
    const copy = key === "addon" ? ({ period: "addon.period", monthNote: "addon.monthNote", yearNote: "addon.yearNote" } as const) : ({ period: `plans.${key}.period`, monthNote: `plans.${key}.monthNote`, yearNote: `plans.${key}.yearNote` } as const);
    return INTERVALS.map((interval) => (
      <div key={interval} className={SHOW[interval]}>
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="condensed text-[2.75rem] leading-none font-extrabold tracking-[-0.03em]">{euros(locale, amounts[interval])}</span>
          <span className="text-small text-ink-soft">{t(copy.period)}</span>
        </p>
        <p className="mt-2 text-small text-ink-soft">
          {interval === "month" ? t(copy.monthNote) : t(copy.yearNote, { total: euros(locale, amounts.year * 12) })}
        </p>
      </div>
    ));
  };

  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <SiteHeader locale={locale} path="/pricing" />

      <main className="flex-1">
        <section className="border-b border-ink">
          <div className={`${WRAP} pt-10 pb-12 sm:pt-14 md:pb-16 lg:pt-20`}>
            <h1 className="condensed max-w-[16ch] text-[2.625rem] leading-[0.95] font-extrabold tracking-[-0.03em] sm:text-display">
              {t("heading")}
            </h1>
            <p className="mt-6 max-w-[58ch] text-body text-ink-soft sm:mt-8 sm:text-lead">{t("lead")}</p>
          </div>
        </section>

        {/* Plans: both prices are in the HTML, the toggle only shows one. */}
        <section className="border-b border-ink">
          <div className={`${WRAP} py-12 md:py-16`}>
            <BillingToggle labels={{ label: t("interval.label"), month: t("interval.month"), year: t("interval.year") }}>
              <p className="mt-3 text-small text-ink-soft">{t("vat")}</p>
              <div className="mt-10 grid border-t border-ink md:grid-cols-2 xl:grid-cols-4">
                {PLAN_KEYS.map((plan) => (
                  <article
                    key={plan}
                    className={`flex flex-col border-b border-rule py-8 md:px-6 md:odd:border-r xl:border-r xl:border-b-0 xl:last:border-r-0 ${
                      plan === "team" ? "bg-sheet px-5" : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                      <h2 className="condensed text-[2rem] leading-none font-extrabold tracking-[-0.03em]">{t(`plans.${plan}.name`)}</h2>
                      {plan === "team" && (
                        <span className="border border-ink bg-ink px-2 py-1 font-mono text-micro text-sheet">
                          {t("plans.team.trial")}
                          <HeatScale orientation="horizontal" className="mt-1 [&>div]:h-0.5" />
                        </span>
                      )}
                    </div>
                    <p className="mt-3 font-medium">{t(`plans.${plan}.who`)}</p>
                    <div className="mt-6 min-h-[6.5rem]">
                      {plan === "solo" || plan === "team" ? (
                        price(plan)
                      ) : plan === "free" ? (
                        <>
                          <p className="flex flex-wrap items-baseline gap-x-2">
                            <span className="condensed text-[2.75rem] leading-none font-extrabold tracking-[-0.03em]">
                              {euros(locale, 0)}
                            </span>
                            <span className="text-small text-ink-soft">{t("plans.free.period")}</span>
                          </p>
                          <p className="mt-2 text-small text-ink-soft">{t("plans.free.note")}</p>
                        </>
                      ) : (
                        <>
                          <p className="condensed text-[2.75rem] leading-none font-extrabold tracking-[-0.03em]">
                            {t("plans.enterprise.price")}
                          </p>
                          <p className="mt-2 text-small text-ink-soft">{t("plans.enterprise.note")}</p>
                        </>
                      )}
                    </div>
                    <ul className="mt-6 flex-1 border-t border-rule">
                      {Object.entries(MESSAGES[locale].pricing.plans[plan].features).map(([key, feature]) => (
                        <li key={key} className="flex gap-3 border-b border-rule py-3 text-body">
                          <Icon name="check" className="mt-1 size-4 shrink-0 text-ink-soft" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <a
                      href={
                        plan === "enterprise"
                          ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(th("pricingStrip.mailSubject"))}`
                          : appUrl(locale)
                      }
                      className={`group mt-6 flex h-12 items-center justify-between px-4 font-semibold transition-colors ${
                        plan === "team"
                          ? "bg-ink text-sheet hover:bg-ink/90"
                          : "border border-ink hover:bg-ink hover:text-sheet"
                      }`}
                    >
                      {plan === "enterprise" ? th("pricingStrip.enterpriseAction") : ts("submit")}
                      <Icon name="arrow" className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1" />
                    </a>
                  </article>
                ))}
              </div>
              {/* The connected-mailbox add-on: campaigns send from the seller's own mailbox, paid per mailbox on Solo and Team. */}
              <div className="grid gap-6 border-b border-rule py-8 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-12 lg:gap-20">
                <div>
                  <h2 className="condensed text-[2rem] leading-none font-extrabold tracking-[-0.03em]">{t("addon.name")}</h2>
                  <p className="mt-3 font-medium">{t("addon.who")}</p>
                </div>
                <div className="md:max-w-[32rem]">{price("addon")}</div>
              </div>
            </BillingToggle>
          </div>
        </section>

        {/* Comparison: scrolls inside its own box on a phone, the page never does. */}
        <section className="border-b border-ink bg-sheet">
          <div className={`${WRAP} py-16 md:py-20`}>
            <h2 className="condensed text-title font-bold">{t("table.title")}</h2>
            <div className="mt-10 overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-small sm:text-body">
                <caption className="sr-only">{t("table.caption")}</caption>
                <thead>
                  <tr className="border-b border-ink align-bottom">
                    <th scope="col" className="w-[36%] pr-4 pb-3 font-medium text-ink-soft">
                      {t("table.feature")}
                    </th>
                    {PLAN_KEYS.map((plan) => (
                      <th key={plan} scope="col" className="px-3 pb-3 font-semibold">
                        {t(`plans.${plan}.name`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.map((row) => (
                    <tr key={row.key} className="border-b border-rule align-top">
                      <th scope="row" className="py-3 pr-4 font-medium">
                        {t(`table.rows.${row.key}`)}
                      </th>
                      {PLAN_KEYS.map((plan) => {
                        const cell = row.cells[plan];
                        return (
                          <td key={plan} className="px-3 py-3">
                            {cell === true ? (
                              <>
                                <Icon name="check" className="size-4" />
                                <span className="sr-only">{t("table.included")}</span>
                              </>
                            ) : cell === false ? (
                              <>
                                <span aria-hidden className="text-ink-soft">
                                  –
                                </span>
                                <span className="sr-only">{t("table.notIncluded")}</span>
                              </>
                            ) : cell === null ? (
                              t("table.unlimited")
                            ) : cell === "addon" ? (
                              t("table.perMailbox", { price: euros(locale, MAILBOX_MONTHLY_PRICE.month) })
                            ) : "monthly" in row && row.monthly ? (
                              t("table.perMonth", { count: cell })
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ, mirrored as FAQPage structured data like the home page. */}
        <section className="border-b border-ink">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ.map((item) => ({
                  "@type": "Question",
                  name: t(`faq.${item}.q`),
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: t.markup(`faq.${item}.a`, { billing: (chunks) => chunks, security: (chunks) => chunks, dpa: (chunks) => chunks }),
                  },
                })),
              }).replace(/</g, "\\u003c"),
            }}
          />
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed text-title font-bold">{t("faq.title")}</h2>
              <p className="mt-6 text-lead text-ink-soft">
                {th.rich("faq.more", {
                  link: (chunks) => (
                    <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium text-ink underline underline-offset-4">
                      {chunks}
                    </a>
                  ),
                })}
              </p>
            </div>
            <div className="border-t border-ink">
              {FAQ.map((item) => (
                <details key={item} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.125rem] font-semibold [&::-webkit-details-marker]:hidden">
                    {t(`faq.${item}.q`)}
                    <Icon
                      name="plus"
                      className="size-5 shrink-0 transition-transform duration-300 ease-[var(--ease-out-expo)] group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-[62ch] pb-6 text-body text-ink-soft">{t.rich(`faq.${item}.a`, { billing: billingLink, security: securityLink, dpa: dpaLink })}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Close: the same field as the home page. */}
        <section>
          <div className={`${WRAP} grid gap-10 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end lg:gap-16`}>
            <h2 className="condensed max-w-[18ch] text-title font-extrabold sm:text-[clamp(2.5rem,1.4rem+3vw,4.5rem)] sm:leading-[0.95]">
              {t("final")}
            </h2>
            <div>
              <SignupForm id="email-pricing" locale={locale} />
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-soft">
                <span>{th("hero.free")}</span>
                <span>{th("hero.noCard")}</span>
                <Link href="/security" className="underline-offset-4 hover:text-ink hover:underline">
                  {th("hero.europe")}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} path="/pricing" />
    </div>
  );
}
