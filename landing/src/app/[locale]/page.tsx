import type { Metadata } from "next";
import Image, { type StaticImageData } from "next/image";
import { getTranslations } from "next-intl/server";

import chainEn from "@/assets/reading/chain-en.png";
import chainFr from "@/assets/reading/chain-fr.png";
import readingEn from "@/assets/reading/reading-en.png";
import readingFr from "@/assets/reading/reading-fr.png";
import actionsEn from "@/assets/prospect/actions-en.png";
import actionsFr from "@/assets/prospect/actions-fr.png";
import changeEn from "@/assets/prospect/change-en.png";
import changeFr from "@/assets/prospect/change-fr.png";
import followUpEn from "@/assets/steps/followUp-en.png";
import followUpFr from "@/assets/steps/followUp-fr.png";
import sendEn from "@/assets/steps/send-en.png";
import sendFr from "@/assets/steps/send-fr.png";
import uploadEn from "@/assets/steps/upload-en.png";
import uploadFr from "@/assets/steps/upload-fr.png";
import teamEn from "@/assets/team/team-en.png";
import teamFr from "@/assets/team/team-fr.png";
import teamMobileEn from "@/assets/team/team-mobile-en.png";
import teamMobileFr from "@/assets/team/team-mobile-fr.png";
import todayDesktopEn from "@/assets/today/desktop-en.png";
import todayDesktopFr from "@/assets/today/desktop-fr.png";
import todayMobileEn from "@/assets/today/mobile-en.png";
import todayMobileFr from "@/assets/today/mobile-fr.png";
import { Icon } from "@/components/icons";
import { CONTACT_EMAIL, EXTENSION_STORE_URL, appUrl } from "@/components/links";
import { SignupForm } from "@/components/signup-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HeatScale } from "@/components/thermal-plate";
import { ThermalReading } from "@/components/thermal-reading";
import { READING_PAGES } from "@/components/thermal-reading-data";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/page";
import type { Locale } from "@/i18n/routing";
import { alternatesFor } from "@/i18n/seo";

// Copy lives in messages/<locale>.json under "home"; these keys set the order on the page.
const SILENCE_ROWS = ["opened", "depth", "forwarded", "reply"] as const;
const STEPS = ["upload", "send", "followUp"] as const;
// Real app screens (local app on example data), one per step and language.
const STEP_SCREENS: Record<(typeof STEPS)[number], Record<Locale, StaticImageData>> = {
  upload: { fr: uploadFr, en: uploadEn },
  send: { fr: sendFr, en: sendEn },
  followUp: { fr: followUpFr, en: followUpEn },
};
const READING_SCREENS: Record<"reading" | "chain", Record<Locale, StaticImageData>> = {
  reading: { fr: readingFr, en: readingEn },
  chain: { fr: chainFr, en: chainEn },
};
const CHANNELS = ["web", "outlook", "chat", "cold"] as const;
const FOLLOWUP_POINTS = ["brief", "stuck", "approve", "delicate"] as const;
const TODAY_SCREENS: Record<"desktop" | "mobile", Record<Locale, StaticImageData>> = {
  desktop: { fr: todayDesktopFr, en: todayDesktopEn },
  mobile: { fr: todayMobileFr, en: todayMobileEn },
};
const PROSPECT_POINTS = ["approve", "book", "ask", "language"] as const;
const PROSPECT_SCREENS: Record<"actions" | "change", Record<Locale, StaticImageData>> = {
  actions: { fr: actionsFr, en: actionsEn },
  change: { fr: changeFr, en: changeEn },
};
const READING_POINTS = ["pages", "readers", "live", "score"] as const;
const GUARANTEES = ["informed", "discreet", "limit", "unsubscribe"] as const;
const TEAM_SCREENS: Record<"desktop" | "mobile", Record<Locale, StaticImageData>> = {
  desktop: { fr: teamFr, en: teamEn },
  mobile: { fr: teamMobileFr, en: teamMobileEn },
};
const FAQ = ["email", "informed", "install", "tools", "auto", "beta", "data"] as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return { alternates: alternatesFor(locale, "/") };
}

const WRAP = "mx-auto w-full max-w-[90rem] px-5 sm:px-8";

export default async function Home({ params }: Props) {
  const locale = await resolveLocale(params);
  const [t, tr, ts] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "reading" }),
    getTranslations({ locale, namespace: "signup" }),
  ]);

  const pages = READING_PAGES.map((page) => ({
    label: tr(`pages.${page.key}.label`),
    heading: tr(`pages.${page.key}.heading`),
    time: page.time,
    heat: page.heat,
  }));

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

        {/* How it works: the protocol, three rows. */}
        <section id="comment" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[22ch] text-title font-bold">{t("steps.title")}</h2>
            <ol className="mt-12 border-t border-ink md:mt-14">
              {STEPS.map((step, index) => (
                <li
                  key={step}
                  className="grid gap-6 border-b border-rule py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-12 lg:gap-20"
                >
                  <div>
                    <span className="font-mono text-small text-ink-soft">{index + 1}/3</span>
                    <h3 className="condensed mt-3 text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{t(`steps.${step}.title`)}</h3>
                    <p className="mt-3 max-w-[48ch] text-body text-ink-soft">{t(`steps.${step}.body`)}</p>
                  </div>
                  <figure className="w-full max-w-[37rem] md:justify-self-end">
                    <Image
                      src={STEP_SCREENS[step][locale]}
                      alt={t(`steps.${step}.alt`)}
                      sizes="(min-width: 768px) 37rem, calc(100vw - 2.5rem)"
                      className="w-full border border-rule"
                    />
                    <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
                  </figure>
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[52ch] text-body">{t("steps.guided")}</p>
              <a
                href={appUrl(locale)}
                className="group flex h-14 shrink-0 items-center justify-between gap-6 bg-ink px-5 text-lead font-semibold text-sheet transition-colors hover:bg-ink/90"
              >
                {ts("submit")}
                <Icon name="arrow" className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1" />
              </a>
            </div>
          </div>
        </section>

        <section id="fonctionnalites" className="scroll-mt-14 border-b border-ink bg-sheet">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <h2 className="condensed max-w-[16ch] text-title font-bold">{t("reading.title")}</h2>
              <p className="mt-6 max-w-[52ch] text-lead text-ink-soft">{t("reading.body")}</p>
              <ul className="mt-10 border-t border-ink">
                {READING_POINTS.map((point) => (
                  <li key={point} className="border-b border-rule py-5">
                    <h3 className="text-[1.125rem] leading-snug font-semibold">{t(`reading.${point}.title`)}</h3>
                    <p className="mt-1 max-w-[52ch] text-body text-ink-soft">{t(`reading.${point}.body`)}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-small text-ink-soft">{t("reading.ownOpens")}</p>
            </div>
            <div className="grid content-start gap-8">
              {(["reading", "chain"] as const).map((screen) => (
                <figure key={screen} className="w-full max-w-[39rem] lg:justify-self-end">
                  <Image
                    src={READING_SCREENS[screen][locale]}
                    alt={t(`reading.${screen}Alt`)}
                    sizes="(min-width: 1024px) 39rem, calc(100vw - 2.5rem)"
                    className="w-full border border-rule"
                  />
                  <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Follow-ups: the Today board as proof, then the four rules it follows. */}
        <section id="relances" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[24ch] text-title font-bold">
              {t.rich("followUps.title", { nowrap: (chunks) => <span className="whitespace-nowrap">{chunks}</span> })}
            </h2>
            <p className="mt-6 max-w-[60ch] text-lead text-ink-soft">{t("followUps.body")}</p>
            <figure className="mt-12 md:mt-14">
              <Image
                src={TODAY_SCREENS.mobile[locale]}
                alt={t("followUps.alt")}
                sizes="calc(100vw - 2.5rem)"
                className="mx-auto w-full max-w-[24rem] border border-rule md:hidden"
              />
              <Image
                src={TODAY_SCREENS.desktop[locale]}
                alt={t("followUps.alt")}
                sizes="(min-width: 1440px) 85rem, calc(100vw - 4rem)"
                className="w-full border border-rule max-md:hidden"
              />
              <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
            </figure>
            <ul className="mt-12 grid border-t border-ink md:grid-cols-2 lg:grid-cols-4">
              {FOLLOWUP_POINTS.map((point) => (
                <li key={point} className="border-b border-rule py-6 md:pr-8 lg:border-b-0">
                  <h3 className="text-[1.125rem] leading-snug font-semibold">{t(`followUps.${point}.title`)}</h3>
                  <p className="mt-2 max-w-[44ch] text-body text-ink-soft">{t(`followUps.${point}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Prospect side: two real phone screens, then what the prospect can do without writing to the seller. */}
        <section id="prospect" className="scroll-mt-14 border-b border-ink bg-sheet">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-20`}>
            <div className="lg:order-2">
              <h2 className="condensed max-w-[18ch] text-title font-bold">{t("prospect.title")}</h2>
              <p className="mt-6 max-w-[52ch] text-lead text-ink-soft">{t("prospect.body")}</p>
              <ul className="mt-10 border-t border-ink">
                {PROSPECT_POINTS.map((point) => (
                  <li key={point} className="border-b border-rule py-5">
                    <h3 className="text-[1.125rem] leading-snug font-semibold">{t(`prospect.${point}.title`)}</h3>
                    <p className="mt-1 max-w-[52ch] text-body text-ink-soft">{t(`prospect.${point}.body`)}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
              {(["actions", "change"] as const).map((screen) => (
                <figure key={screen} className={screen === "change" ? "max-sm:hidden" : "mx-auto w-full max-w-[20rem] sm:max-w-none"}>
                  <Image
                    src={PROSPECT_SCREENS[screen][locale]}
                    alt={t(`prospect.${screen}Alt`)}
                    sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 20rem"
                    className="w-full border border-ink"
                  />
                  <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Channels: where the link goes out, one row each; the only other button on the page leads to the store. */}
        <section id="envoi" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed max-w-[16ch] text-title font-bold">{t("channels.title")}</h2>
              <p className="mt-6 max-w-[44ch] text-lead text-ink-soft">{t("channels.body")}</p>
              <a
                href={EXTENSION_STORE_URL}
                className="group mt-10 flex h-12 max-w-xs items-center justify-between border border-ink px-4 font-semibold transition-colors hover:bg-ink hover:text-sheet"
              >
                {t("channels.store")}
                <Icon name="arrow" className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1" />
              </a>
              <p className="mt-3 text-small text-ink-soft">{t("channels.storeNote")}</p>
            </div>
            <table className="w-full border-t border-ink text-left">
              <caption className="sr-only">{t("channels.caption")}</caption>
              <thead className="sr-only">
                <tr>
                  <th scope="col">{t("channels.where")}</th>
                  <th scope="col">{t("channels.how")}</th>
                </tr>
              </thead>
              <tbody>
                {CHANNELS.map((channel) => (
                  <tr key={channel} className="grid gap-2 border-b border-rule py-6 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8">
                    <th scope="row" className="condensed text-[1.5rem] leading-tight font-bold tracking-[-0.02em]">
                      {t(`channels.${channel}.name`)}
                    </th>
                    <td className="max-w-[52ch] text-body text-ink-soft">{t(`channels.${channel}.how`)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Respect: the one dark band. */}
        <section className="bg-ink text-sheet">
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div>
              <h2 className="condensed text-title font-bold">{t("trust.title")}</h2>
              <p className="mt-6 max-w-[48ch] text-lead text-sheet/75">{t("trust.body")}</p>
              <Link
                href="/subprocessors"
                className="mt-8 inline-block text-body font-semibold underline decoration-sheet/40 underline-offset-4 transition-colors hover:decoration-sheet"
              >
                {t("trust.subprocessors")}
                <Icon name="arrow" className="ml-2 inline size-4 align-[-0.15em]" />
              </Link>
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

        {/* Segments: the team offer first, with its real screen; no prices exist yet, so none are shown. */}
        <section id="pour-qui" className="scroll-mt-14 border-b border-ink">
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[20ch] text-title font-bold">{t("who.title")}</h2>
            <p className="mt-6 max-w-[56ch] text-lead text-ink-soft">{t("who.beta")}</p>
            <div className="mt-14 grid gap-10 border-t border-ink pt-10 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-16">
              <article className="flex flex-col">
                <h3 className="condensed text-[2.5rem] leading-none font-extrabold tracking-[-0.03em]">{t("who.team.name")}</h3>
                <p className="mt-4 font-medium">{t("who.team.who")}</p>
                <p className="mt-2 text-body text-ink-soft">{t("who.team.body")}</p>
                <p className="mt-8 text-small font-semibold">{t("who.team.offer")}</p>
                <a
                  href={appUrl(locale)}
                  className="group mt-3 flex h-12 items-center justify-between bg-ink px-4 font-semibold text-sheet transition-colors hover:bg-ink/90"
                >
                  {ts("submit")}
                  <Icon name="arrow" className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1" />
                </a>
              </article>
              <figure>
                <Image
                  src={TEAM_SCREENS.mobile[locale]}
                  alt={t("who.teamAlt")}
                  sizes="calc(100vw - 2.5rem)"
                  className="mx-auto w-full max-w-[24rem] border border-rule md:hidden"
                />
                <Image
                  src={TEAM_SCREENS.desktop[locale]}
                  alt={t("who.teamAlt")}
                  sizes="(min-width: 1440px) 56rem, (min-width: 1024px) 62vw, calc(100vw - 4rem)"
                  className="w-full border border-rule max-md:hidden"
                />
                <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
              </figure>
            </div>
            <div className="mt-14 grid border-t border-ink md:grid-cols-2">
              {(["solo", "enterprise"] as const).map((segment) => (
                <article
                  key={segment}
                  className="flex flex-col border-b border-rule py-8 md:border-b-0 md:px-8 md:first:border-r md:first:pl-0 md:last:pr-0"
                >
                  <h3 className="condensed text-[2rem] leading-none font-extrabold tracking-[-0.03em]">{t(`who.${segment}.name`)}</h3>
                  <p className="mt-4 font-medium">{t(`who.${segment}.who`)}</p>
                  <p className="mt-2 flex-1 text-body text-ink-soft">{t(`who.${segment}.body`)}</p>
                  <p className="mt-6 text-small font-semibold">{t(`who.${segment}.offer`)}</p>
                  <a
                    href={
                      segment === "enterprise"
                        ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t("who.enterprise.mailSubject"))}`
                        : appUrl(locale)
                    }
                    className="group mt-3 flex h-12 max-w-sm items-center justify-between border border-ink px-4 font-semibold transition-colors hover:bg-ink hover:text-sheet"
                  >
                    {segment === "enterprise" ? t("who.enterprise.action") : ts("submit")}
                    <Icon name="arrow" className="size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ, mirrored as FAQPage structured data. */}
        <section id="faq" className="scroll-mt-14 border-b border-ink">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "FAQPage",
                mainEntity: FAQ.map((item) => ({
                  "@type": "Question",
                  name: t(`faq.${item}.q`),
                  acceptedAnswer: { "@type": "Answer", text: t.raw(`faq.${item}.a`).replace(/<\/?\w+>/g, "") },
                })),
              }).replace(/</g, "\\u003c"),
            }}
          />
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
                  <p className="max-w-[62ch] pb-6 text-body text-ink-soft">
                    {t.rich(`faq.${item}.a`, {
                      subprocessors: (chunks) => (
                        <Link href="/subprocessors" className="font-medium text-ink underline underline-offset-4">
                          {chunks}
                        </Link>
                      ),
                      privacy: (chunks) => (
                        <Link href="/privacy" className="font-medium text-ink underline underline-offset-4">
                          {chunks}
                        </Link>
                      ),
                    })}
                  </p>
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
