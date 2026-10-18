import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { Icon } from "@/components/icons";
import { CONTACT_EMAIL, EXTENSION_STORE_URL, appUrl } from "@/components/links";
import { SignupForm } from "@/components/signup-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HeatScale, ThermalPlate } from "@/components/thermal-plate";
import { ThermalReading } from "@/components/thermal-reading";
import { READING_PAGES } from "@/components/thermal-reading-data";
import { resolveLocale } from "@/i18n/page";
import { alternatesFor } from "@/i18n/seo";

// Copy lives in messages/<locale>.json under "home"; these keys set the order on the page.
const SILENCE_ROWS = ["opened", "depth", "forwarded", "reply"] as const;
const STEPS = ["upload", "send", "followUp"] as const;
const SEND_WAYS = [
  { key: "link", available: true, store: false },
  { key: "mail", available: true, store: true },
] as const;
const FOLLOWUP_STEPS = ["read", "stuck", "schedule"] as const;
const READINGS = ["pages", "live", "score", "deal", "reply"] as const;
const SCORE_REASONS = [
  { points: "+34", key: "pricing" },
  { points: "+22", key: "back" },
  { points: "+18", key: "forwarded" },
  { points: "+12", key: "method" },
] as const;
const GUARANTEES = ["informed", "discreet", "limit", "unsubscribe"] as const;
const SEGMENTS = ["solo", "team", "enterprise"] as const;
const BETA_INCLUDES = ["formats", "extension", "tracking", "deals", "replies"] as const;
const FAQ = ["informed", "auto", "documents", "ownOpens", "install", "extension", "replies"] as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return { alternates: alternatesFor(locale, "/") };
}

const WRAP = "mx-auto w-full max-w-[90rem] px-5 sm:px-8";

export default async function Home({ params }: Props) {
  const locale = await resolveLocale(params);
  const [t, tr] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "reading" }),
  ]);

  const pages = READING_PAGES.map((page) => ({
    label: tr(`pages.${page.key}.label`),
    heading: tr(`pages.${page.key}.heading`),
    time: page.time,
    heat: page.heat,
  }));

  const segmentHref = (segment: (typeof SEGMENTS)[number]) =>
    segment === "enterprise"
      ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t("who.enterprise.mailSubject"))}`
      : appUrl(locale);

  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <SiteHeader locale={locale} path="/" />

      <main className="flex-1">
        {/* Report header: the promise, and the signup in the "Client" field. */}
        <section className="border-b border-ink">
          <div className={`${WRAP} grid grid-cols-[minmax(0,1fr)] gap-10 pt-8 pb-12 sm:pt-12 md:pb-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,6fr)] lg:items-center lg:gap-16 lg:pt-16 lg:pb-20`}>
            <div>
              <h1 className="condensed text-[2.625rem] leading-[0.95] font-extrabold tracking-[-0.03em] sm:text-display lg:text-[clamp(3rem,1rem+3.6vw,4.75rem)]">
                {t.rich("hero.title", {
                  hot: (chunks) => (
                    <span className="relative inline-block">
                      {chunks}
                      <HeatScale orientation="horizontal" className="absolute inset-x-0 -bottom-1.5 sm:-bottom-3" />
                    </span>
                  ),
                })}
              </h1>
              <p className="mt-6 max-w-[54ch] text-body text-ink-soft sm:mt-8 sm:text-lead">{t("hero.lead")}</p>
              <div className="mt-8 max-w-[26rem] sm:mt-10">
                <SignupForm id="email-hero" locale={locale} />
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-soft">
                  <span>{t("hero.free")}</span>
                  <span>{t("hero.noCard")}</span>
                  <span>{t("hero.magicLink")}</span>
                </p>
              </div>
            </div>
            <ThermalReading
              name={tr("name")}
              caption={tr("caption")}
              summary={tr("summary")}
              pages={pages}
              labels={{ example: t("demo"), hot: tr("hot"), cold: tr("cold") }}
            />
          </div>
        </section>

        <section className="border-b border-ink">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed text-title font-bold">{t("silence.title")}</h2>
              <p className="mt-6 max-w-[56ch] text-lead text-ink-soft">{t("silence.body")}</p>
            </div>
            <table className="w-full table-fixed border-collapse self-center text-left text-small sm:text-body">
              <caption className="sr-only">{t("silence.table.caption")}</caption>
              <thead>
                <tr className="border-b border-ink align-bottom">
                  <td className="w-[30%] sm:w-[34%]" />
                  <th scope="col" className="pr-4 pb-3 font-medium text-ink-soft">
                    {t("silence.table.pdf")}
                  </th>
                  <th scope="col" className="bg-sheet px-4 pt-4 pb-3 font-semibold">
                    {t("silence.table.link")}
                    <span className="mt-0.5 block text-micro font-normal text-ink-soft">{t("silence.table.example")}</span>
                    <HeatScale orientation="horizontal" className="mt-2 h-1.5" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {SILENCE_ROWS.map((row) => (
                  <tr key={row} className="border-b border-rule align-top">
                    <th scope="row" className="py-4 pr-4 font-medium">
                      {t(`silence.table.${row}.label`)}
                    </th>
                    <td className="py-4 pr-4 text-ink-soft">{t(`silence.table.${row}.pdf`)}</td>
                    <td className="bg-sheet px-4 py-4 font-medium">{t(`silence.table.${row}.link`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Two ways to send: the link, or the mailbox extension. */}
        <section id="envoi" className="scroll-mt-14 border-b border-ink bg-sheet">
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[20ch] text-title font-bold">{t("send.title")}</h2>
            <div className="mt-14 grid border-t border-ink md:grid-cols-2">
              {SEND_WAYS.map((way) => (
                <article
                  key={way.key}
                  className="border-b border-rule py-8 md:border-b-0 md:px-8 md:first:border-r md:first:pl-0 md:last:pr-0"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="condensed text-[2rem] leading-none font-extrabold tracking-[-0.03em]">{t(`send.${way.key}.name`)}</h3>
                    <span
                      className={`px-2 py-0.5 text-small font-semibold ${way.available ? "bg-ink text-sheet" : "border border-ink"}`}
                    >
                      {t(`send.${way.key}.status`)}
                    </span>
                  </div>
                  <p className="mt-4 max-w-[58ch] text-body text-ink-soft">{t(`send.${way.key}.body`)}</p>
                  {way.store && (
                    <a
                      href={EXTENSION_STORE_URL}
                      className="group mt-6 flex h-12 max-w-xs items-center justify-between border border-ink px-4 font-semibold transition-colors hover:bg-ink hover:text-sheet"
                    >
                      {t("send.mail.action")}
                      <Icon name="arrow" className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1" />
                    </a>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How it works: the protocol, three rows. */}
        <section id="comment" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[18ch] text-title font-bold">{t("steps.title")}</h2>
            <ol className="mt-14 border-t border-ink">
              {STEPS.map((step, index) => (
                <li
                  key={step}
                  className="grid gap-3 border-b border-rule py-8 md:grid-cols-[4rem_minmax(0,5fr)_minmax(0,6fr)_minmax(0,3fr)] md:gap-8"
                >
                  <span className="font-mono text-small text-ink-soft">{index + 1}/3</span>
                  <h3 className="condensed text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{t(`steps.${step}.title`)}</h3>
                  <p className="max-w-[60ch] text-body text-ink-soft">{t(`steps.${step}.body`)}</p>
                  <p className="text-small font-medium md:text-right">{t(`steps.${step}.measure`)}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Follow-ups: written, timed and guarded by Clozer, approved by the seller. */}
        <section id="relances" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} grid gap-14 py-20 md:py-28 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed max-w-[16ch] text-title font-bold">{t("followUps.title")}</h2>
              <p className="mt-6 max-w-[54ch] text-lead text-ink-soft">{t("followUps.body")}</p>
              <p className="mt-4 max-w-[54ch] text-lead">{t("followUps.approve")}</p>
            </div>
            <figure className="border border-ink bg-sheet lg:self-start">
              <figcaption className="sr-only">{t("followUps.caption")}</figcaption>
              <div aria-hidden>
                <p className="flex items-baseline justify-between gap-4 border-b border-ink px-5 py-3 text-small">
                  <span className="font-semibold">{t("followUps.cardTitle")}</span>
                  <span className="text-ink-soft">{t("followUps.cardStatus")}</span>
                </p>
                <dl className="divide-y divide-rule border-b border-ink px-5">
                  {FOLLOWUP_STEPS.map((step) => (
                    <div key={step} className="grid gap-1 py-3 text-small sm:grid-cols-[9rem_minmax(0,1fr)]">
                      <dt className="text-ink-soft">{t(`followUps.${step}.label`)}</dt>
                      <dd className="font-medium">{t(`followUps.${step}.value`)}</dd>
                    </div>
                  ))}
                </dl>
                <p className="px-5 py-4 text-body">{t("followUps.message")}</p>
                <div className="flex gap-2 px-5 pb-5 text-small font-semibold">
                  <span className="bg-ink px-3 py-2 text-sheet">{t("followUps.send")}</span>
                  <span className="border border-ink px-3 py-2">{t("followUps.edit")}</span>
                </div>
              </div>
              <p className="border-t border-rule px-5 py-2 text-micro text-ink-soft">{t("demo")}</p>
            </figure>
          </div>
        </section>

        {/* What you see: one prospect sheet as the specimen, the readings beside it. */}
        <section id="releves" className="scroll-mt-14 border-b border-ink bg-sheet">
          <div className={`${WRAP} grid gap-14 py-20 md:py-28 lg:grid-cols-[minmax(0,6fr)_minmax(0,7fr)] lg:gap-20`}>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="condensed max-w-[16ch] text-title font-bold">{t("readings.title")}</h2>
              <ProspectSheet t={t} />
            </div>
            <ul className="border-t border-ink lg:mt-2">
              {READINGS.map((item) => (
                <li key={item} className="border-b border-rule py-7">
                  <h3 className="text-[1.25rem] leading-snug font-semibold tracking-[-0.01em]">{t(`readings.${item}.title`)}</h3>
                  <p className="mt-2 max-w-[62ch] text-body text-ink-soft">{t(`readings.${item}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Respect: the one dark band. */}
        <section className="bg-ink text-sheet">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed text-title font-bold">{t("trust.title")}</h2>
              <p className="mt-6 max-w-[48ch] text-lead text-sheet/75">{t("trust.body")}</p>
            </div>
            <ul className="border-t border-sheet/30 self-center">
              {GUARANTEES.map((item) => (
                <li key={item} className="flex gap-4 border-b border-sheet/20 py-5 text-lead">
                  <Icon name="check" className="mt-1 size-5 shrink-0 text-sheet/60" />
                  {t(`trust.${item}`)}
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Segments: no prices exist yet, so none are shown. */}
        <section id="pour-qui" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} py-20 md:py-28`}>
            <div className="flex flex-wrap items-end justify-between gap-6">
              <h2 className="condensed max-w-[16ch] text-title font-bold">{t("who.title")}</h2>
              <p className="max-w-[40ch] text-body text-ink-soft">{t("who.beta")}</p>
            </div>
            <div className="mt-14 grid border-t border-ink md:grid-cols-3">
              {SEGMENTS.map((segment) => (
                <article
                  key={segment}
                  className="flex flex-col border-b border-rule py-8 md:border-r md:border-b-0 md:px-8 md:first:pl-0 md:last:border-r-0 md:last:pr-0"
                >
                  <h3 className="condensed text-[2.5rem] leading-none font-extrabold tracking-[-0.03em]">{t(`who.${segment}.name`)}</h3>
                  <p className="mt-4 font-medium">{t(`who.${segment}.who`)}</p>
                  <p className="mt-2 flex-1 text-body text-ink-soft">{t(`who.${segment}.body`)}</p>
                  <p className="mt-8 text-small font-semibold">{t(`who.${segment}.offer`)}</p>
                  <a
                    href={segmentHref(segment)}
                    className="group mt-3 flex h-12 items-center justify-between border border-ink px-4 font-semibold transition-colors hover:bg-ink hover:text-sheet"
                  >
                    {t(`who.${segment}.action`)}
                    <Icon name="arrow" className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1" />
                  </a>
                </article>
              ))}
            </div>
            <p className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-small text-ink-soft">
              <span className="font-medium text-ink">{t("who.includedLabel")}</span>
              {BETA_INCLUDES.map((item) => (
                <span key={item}>{t(`who.included.${item}`)}</span>
              ))}
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed text-title font-bold">{t("faq.title")}</h2>
              <p className="mt-6 text-lead text-ink-soft">
                {t.rich("faq.more", {
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
                  <p className="max-w-[62ch] pb-6 text-body text-ink-soft">{t(`faq.${item}.a`)}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Close: the same field, once more. */}
        <section>
          <div className={`${WRAP} grid gap-10 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end lg:gap-16`}>
            <h2 className="condensed max-w-[14ch] text-display font-extrabold">{t("final")}</h2>
            <SignupForm id="email-final" locale={locale} />
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} path="/" />
    </div>
  );
}

type HomeT = Awaited<ReturnType<typeof getTranslations<"home">>>;

function ProspectSheet({ t }: { t: HomeT }) {
  return (
    <figure className="mt-10 border border-ink bg-paper">
      <figcaption className="sr-only">{t("sheet.caption")}</figcaption>
      <div aria-hidden>
        <div className="flex items-start justify-between gap-4 border-b border-ink p-5">
          <div>
            <p className="text-lead font-semibold">Marie Dupont</p>
            <p className="text-small text-ink-soft">{t("sheet.proposal")}</p>
          </div>
          <div className="text-right">
            <p className="condensed text-[2.75rem] leading-none font-extrabold">86</p>
            <p className="font-mono text-micro text-ink-soft">{t("sheet.score")}</p>
          </div>
        </div>
        <div className="grid grid-cols-6 gap-1 border-b border-ink p-5">
          {[0.3, 0.5, 0.68, 1, 0.38, 0].map((heat, i) => (
            <ThermalPlate key={i} heat={heat} seed={i} className="aspect-[3/4]" />
          ))}
        </div>
        <ul className="divide-y divide-rule px-5">
          {SCORE_REASONS.map((reason) => (
            <li key={reason.key} className="flex items-baseline gap-4 py-2.5 text-small">
              <span className="w-8 font-mono">{reason.points}</span>
              {t(`sheet.reasons.${reason.key}`)}
            </li>
          ))}
        </ul>
      </div>
      <p className="border-t border-rule px-5 py-2 text-micro text-ink-soft">{t("demo")}</p>
    </figure>
  );
}
