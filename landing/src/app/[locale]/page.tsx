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
import { ANCHORS, LEGACY_ANCHORS } from "@/components/anchors";
import { CONTACT_EMAIL, EXTENSION_STORE_URL, appUrl } from "@/components/links";
import { SignupForm } from "@/components/signup-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HeatScale } from "@/components/thermal-plate";
import { ThermalReading } from "@/components/thermal-reading";
import { ThermalSequence } from "@/components/thermal-sequence";
import { ThermalVideo } from "@/components/thermal-video";
import { READING_PAGES } from "@/components/thermal-reading-data";
import { SoftwareStructuredData } from "@/components/structured-data";
import { MONTHLY_PRICE, euros } from "@/content/pricing";
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
// Where the link goes out, listed under the "send" step; the store button hangs off the first row.
const CHANNELS = ["mail", "chat", "campaign"] as const;
const READING_SCREENS: Record<"reading" | "chain", Record<Locale, StaticImageData>> = {
  reading: { fr: readingFr, en: readingEn },
  chain: { fr: chainFr, en: chainEn },
};
const READING_POINTS = ["pages", "readers", "live", "score"] as const;
const TEAM_SCREENS: Record<"desktop" | "mobile", Record<Locale, StaticImageData>> = {
  desktop: { fr: teamFr, en: teamEn },
  mobile: { fr: teamMobileFr, en: teamMobileEn },
};
const FOLLOWUP_POINTS = ["brief", "stuck", "approve", "delicate"] as const;
const TODAY_SCREENS: Record<"desktop" | "mobile", Record<Locale, StaticImageData>> = {
  desktop: { fr: todayDesktopFr, en: todayDesktopEn },
  mobile: { fr: todayMobileFr, en: todayMobileEn },
};
const CAMPAIGN_POINTS = ["sequence", "pace", "read", "stop"] as const;
const SEQUENCE_ROWS = ["step1", "step2", "read", "followUp", "cancelled"] as const;
const PROSPECT_POINTS = ["approve", "book", "ask", "language"] as const;
const PROSPECT_SCREENS: Record<"actions" | "change", Record<Locale, StaticImageData>> = {
  actions: { fr: actionsFr, en: actionsEn },
  change: { fr: changeFr, en: changeEn },
};
const GUARANTEES = ["informed", "discreet", "limit", "unsubscribe", "europe", "private"] as const;
const PLANS = ["free", "solo", "team", "enterprise"] as const;
const FAQ = ["email", "informed", "install", "tools", "cold", "mailbox", "auto", "data"] as const;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  return { alternates: alternatesFor(locale, "/") };
}

const WRAP = "mx-auto w-full max-w-[90rem] px-5 sm:px-8";
const SPLIT = "grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20";
const ROW = "grid gap-6 border-b border-rule py-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:items-center md:gap-12 lg:gap-20";
const POINT_TITLE = "text-[1.125rem] leading-snug font-semibold";
const SCREEN = "w-full border border-rule";
const ARROW = "size-5 transition-transform duration-300 ease-[var(--ease-out-expo)] group-hover:translate-x-1";
const BUTTON_INK = "group flex h-12 items-center justify-between bg-ink px-4 font-semibold text-sheet transition-colors hover:bg-ink/90";
const BUTTON_OUTLINE = "group flex h-12 items-center justify-between border border-ink px-4 font-semibold transition-colors hover:bg-ink hover:text-sheet";

export default async function Home({ params }: Props) {
  const locale = await resolveLocale(params);
  const [t, tr, ts, tp] = await Promise.all([
    getTranslations({ locale, namespace: "home" }),
    getTranslations({ locale, namespace: "reading" }),
    getTranslations({ locale, namespace: "signup" }),
    getTranslations({ locale, namespace: "pricing" }),
  ]);

  const anchors = ANCHORS[locale];
  const legacy = LEGACY_ANCHORS[locale];
  const alias = (section: keyof typeof anchors) =>
    legacy[section]?.map((id) => <span key={id} id={id} aria-hidden className="block scroll-mt-14" />);
  const pages = READING_PAGES.map((page) => ({
    label: tr(`pages.${page.key}.label`),
    heading: tr(`pages.${page.key}.heading`),
    time: page.time,
    heat: page.heat,
  }));
  const pricingLink = (chunks: React.ReactNode) => (
    <Link href="/pricing" className="font-medium text-ink underline underline-offset-4">
      {chunks}
    </Link>
  );
  const screen = (src: StaticImageData, alt: string, sizes: string, className = "") => (
    <figure className={className}>
      <Image src={src} alt={alt} sizes={sizes} className={SCREEN} />
      <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
    </figure>
  );
  // The strip's price line per plan: the pricing page's own words, so the two never drift apart.
  const planPrice: Record<(typeof PLANS)[number], string> = {
    free: `${euros(locale, 0)} · ${tp("plans.free.period")}`,
    solo: `${euros(locale, MONTHLY_PRICE.solo.month)} ${tp("plans.solo.period")}`,
    team: `${euros(locale, MONTHLY_PRICE.team.month)} ${tp("plans.team.period")}`,
    enterprise: tp("plans.enterprise.price"),
  };

  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <SoftwareStructuredData locale={locale} />
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
                  <Link href="/security" className="underline-offset-4 hover:text-ink hover:underline">
                    {t("hero.europe")}
                  </Link>
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

        {/* The problem: what an attachment tells you, against what the link tells you. */}
        <section className="border-b border-ink">
          <div className={`${WRAP} ${SPLIT}`}>
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

        {/* How it works: three rows; the second lists where the link goes out. */}
        <section id={anchors.how} className="scroll-mt-14 border-b border-ink">
          {alias("how")}
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[22ch] text-title font-bold">{t("steps.title")}</h2>
            <ol className="mt-12 border-t border-ink md:mt-14">
              {STEPS.map((step, index) => (
                <li key={step} className={`${ROW} md:items-start`}>
                  <div>
                    <span className="font-mono text-small text-ink-soft">{index + 1}/{STEPS.length}</span>
                    <h3 className="condensed mt-3 text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{t(`steps.${step}.title`)}</h3>
                    <p className="mt-3 max-w-[48ch] text-body text-ink-soft">{t(`steps.${step}.body`)}</p>
                    {step === "send" && (
                      <ul className="mt-6 border-t border-rule">
                        {CHANNELS.map((channel) => (
                          <li key={channel} className="border-b border-rule py-4">
                            <h4 className={POINT_TITLE}>{t(`steps.send.channels.${channel}.name`)}</h4>
                            <p className="mt-1 max-w-[52ch] text-body text-ink-soft">{t(`steps.send.channels.${channel}.how`)}</p>
                            {channel === "mail" && (
                              <>
                                <a href={EXTENSION_STORE_URL} className={`${BUTTON_OUTLINE} mt-4 h-11 max-w-xs`}>
                                  {t("steps.send.store")}
                                  <Icon name="arrow" className={ARROW} />
                                </a>
                                <p className="mt-2 text-small text-ink-soft">{t("steps.send.storeNote")}</p>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  {screen(STEP_SCREENS[step][locale], t(`steps.${step}.alt`), "(min-width: 768px) 37rem, calc(100vw - 2.5rem)", "w-full max-w-[37rem] md:justify-self-end md:sticky md:top-24")}
                </li>
              ))}
            </ol>
            <div className="mt-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="max-w-[52ch] text-body">{t("steps.guided")}</p>
              <a href={appUrl(locale)} className={`${BUTTON_INK} h-14 shrink-0 gap-6 px-5 text-lead`}>
                {ts("submit")}
                <Icon name="arrow" className={ARROW} />
              </a>
            </div>
          </div>
        </section>

        {/* What you see: the same reading on a document, on a video, across the team. */}
        <section id={anchors.features} className="scroll-mt-14 border-b border-ink bg-sheet">
          {alias("features")}
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[20ch] text-title font-bold">{t("see.title")}</h2>
            <p className="mt-6 max-w-[56ch] text-lead text-ink-soft">{t("see.body")}</p>
            <ul className="mt-12 border-t border-ink md:mt-14">
              <li className={`${ROW} md:items-start`}>
                <div className="md:sticky md:top-24">
                  <h3 className="condensed text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{t("see.doc.title")}</h3>
                  <ul className="mt-6 border-t border-rule">
                    {READING_POINTS.map((point) => (
                      <li key={point} className="border-b border-rule py-4">
                        <h4 className={POINT_TITLE}>{t(`see.doc.${point}.title`)}</h4>
                        <p className="mt-1 max-w-[52ch] text-body text-ink-soft">{t(`see.doc.${point}.body`)}</p>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-4 text-small text-ink-soft">{t("see.doc.ownOpens")}</p>
                </div>
                <div className="grid content-start gap-8">
                  {(["reading", "chain"] as const).map((key) =>
                    screen(READING_SCREENS[key][locale], t(`see.doc.${key}Alt`), "(min-width: 1024px) 39rem, calc(100vw - 2.5rem)", "w-full max-w-[39rem] md:justify-self-end"),
                  )}
                </div>
              </li>
              <li className={`${ROW} md:items-start`}>
                <div>
                  <h3 className="condensed text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{t("see.video.title")}</h3>
                  <p className="mt-3 max-w-[48ch] text-body text-ink-soft">{t("see.video.body")}</p>
                  <p className="mt-4 max-w-[48ch] text-small text-ink-soft">{t("see.video.capsules")}</p>
                </div>
                <div className="w-full max-w-[39rem] md:justify-self-end">
                  <ThermalVideo
                    name={t("see.video.name")}
                    caption={t("see.video.caption")}
                    summary={t("see.video.summary")}
                    labels={{
                      example: t("demo"),
                      skipped: t("see.video.skipped"),
                      hottest: t("see.video.hottest"),
                      quote: t("see.video.quoteButton"),
                      hot: tr("hot"),
                      cold: tr("cold"),
                    }}
                  />
                </div>
              </li>
              <li className={ROW}>
                <div>
                  <h3 className="condensed text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{t("see.team.title")}</h3>
                  <p className="mt-3 max-w-[48ch] text-body text-ink-soft">{t("see.team.body")}</p>
                </div>
                <figure>
                  <Image src={TEAM_SCREENS.mobile[locale]} alt={t("see.team.alt")} sizes="calc(100vw - 2.5rem)" className={`${SCREEN} mx-auto max-w-[24rem] md:hidden`} />
                  <Image src={TEAM_SCREENS.desktop[locale]} alt={t("see.team.alt")} sizes="(min-width: 1440px) 52rem, (min-width: 768px) 58vw, calc(100vw - 4rem)" className={`${SCREEN} max-md:hidden`} />
                  <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
                </figure>
              </li>
            </ul>
          </div>
        </section>

        {/* Follow-ups: the Today board as proof, then the four rules it follows. */}
        <section id={anchors.followUps} className="scroll-mt-14 border-b border-ink">
          {alias("followUps")}
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[24ch] text-title font-bold">
              {t.rich("followUps.title", { nowrap: (chunks) => <span className="whitespace-nowrap">{chunks}</span> })}
            </h2>
            <p className="mt-6 max-w-[60ch] text-lead text-ink-soft">{t("followUps.body")}</p>
            <figure className="mt-12 md:mt-14">
              <Image src={TODAY_SCREENS.mobile[locale]} alt={t("followUps.alt")} sizes="calc(100vw - 2.5rem)" className={`${SCREEN} mx-auto max-w-[24rem] md:hidden`} />
              <Image src={TODAY_SCREENS.desktop[locale]} alt={t("followUps.alt")} sizes="(min-width: 1440px) 85rem, calc(100vw - 4rem)" className={`${SCREEN} max-md:hidden`} />
              <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
            </figure>
            <ul className="mt-12 grid border-t border-ink md:grid-cols-2 lg:grid-cols-4">
              {FOLLOWUP_POINTS.map((point) => (
                <li key={point} className="border-b border-rule py-6 md:pr-8 lg:border-b-0">
                  <h3 className={POINT_TITLE}>{t(`followUps.${point}.title`)}</h3>
                  <p className="mt-2 max-w-[44ch] text-body text-ink-soft">{t(`followUps.${point}.body`)}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Campaigns: the sequence leaves from the seller's own mailbox, and the reading changes its pace. */}
        <section id={anchors.campaigns} className="scroll-mt-14 border-b border-ink bg-sheet">
          {alias("campaigns")}
          <div className={`${WRAP} ${SPLIT}`}>
            <div>
              <h2 className="condensed max-w-[16ch] text-title font-bold">{t("campaigns.title")}</h2>
              <p className="mt-6 max-w-[52ch] text-lead text-ink-soft">{t("campaigns.body")}</p>
              <ul className="mt-10 border-t border-ink">
                {CAMPAIGN_POINTS.map((point) => (
                  <li key={point} className="border-b border-rule py-5">
                    <h3 className={POINT_TITLE}>{t(`campaigns.${point}.title`)}</h3>
                    <p className="mt-1 max-w-[52ch] text-body text-ink-soft">{t(`campaigns.${point}.body`)}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 max-w-[52ch] text-body font-medium">{t.rich("campaigns.price", { link: pricingLink })}</p>
              <p className="mt-4 max-w-[52ch] text-small text-ink-soft">{t("campaigns.smart")}</p>
            </div>
            <div className="lg:sticky lg:top-24 lg:self-start">
              <ThermalSequence
                name={t("campaigns.figure.name")}
                caption={t("campaigns.figure.caption")}
                rows={Object.fromEntries(
                  SEQUENCE_ROWS.map((row) => [
                    row,
                    {
                      when: t(`campaigns.figure.${row}.when`),
                      text: t(`campaigns.figure.${row}.text`),
                      badge: row === "read" ? t("campaigns.figure.read.badge") : undefined,
                      action: row === "followUp" ? t("campaigns.figure.followUp.action") : undefined,
                    },
                  ]),
                ) as Parameters<typeof ThermalSequence>[0]["rows"]}
                labels={{ example: t("demo"), hot: tr("hot"), cold: tr("cold") }}
              />
            </div>
          </div>
        </section>

        {/* Prospect side: two real phone screens, then what the prospect can do without writing to the seller. */}
        <section id={anchors.prospect} className="scroll-mt-14 border-b border-ink">
          {alias("prospect")}
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:gap-20`}>
            <div className="lg:order-2">
              <h2 className="condensed max-w-[18ch] text-title font-bold">{t("prospect.title")}</h2>
              <p className="mt-6 max-w-[52ch] text-lead text-ink-soft">{t("prospect.body")}</p>
              <ul className="mt-10 border-t border-ink">
                {PROSPECT_POINTS.map((point) => (
                  <li key={point} className="border-b border-rule py-5">
                    <h3 className={POINT_TITLE}>{t(`prospect.${point}.title`)}</h3>
                    <p className="mt-1 max-w-[52ch] text-body text-ink-soft">{t(`prospect.${point}.body`)}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid content-start gap-4 sm:grid-cols-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
              {(["actions", "change"] as const).map((key) => (
                <figure key={key} className={key === "change" ? "max-sm:hidden" : "mx-auto w-full max-w-[20rem] sm:max-w-none"}>
                  <Image
                    src={PROSPECT_SCREENS[key][locale]}
                    alt={t(`prospect.${key}Alt`)}
                    sizes="(min-width: 1024px) 18rem, (min-width: 640px) 45vw, 20rem"
                    className="w-full border border-ink"
                  />
                  <figcaption className="mt-2 font-mono text-micro text-ink-soft">{t("screen")}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>

        {/* Respect: the one dark band. */}
        <section className="bg-ink text-sheet">
          <div className={`${WRAP} ${SPLIT}`}>
            <div>
              <h2 className="condensed text-title font-bold">{t("trust.title")}</h2>
              <p className="mt-6 max-w-[48ch] text-lead text-sheet/75">{t("trust.body")}</p>
              <div className="mt-8 flex flex-col items-start gap-3">
                {(["security", "subprocessors"] as const).map((page) => (
                  <Link key={page} href={`/${page}`} className="text-body font-semibold underline decoration-sheet/40 underline-offset-4 transition-colors hover:decoration-sheet">
                    {t(`trust.${page}`)}
                    <Icon name="arrow" className="ml-2 inline size-4 align-[-0.15em]" />
                  </Link>
                ))}
              </div>
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

        {/* Pricing: the four plans in one strip, the details on /pricing. */}
        <section id={anchors.pricing} className="scroll-mt-14 border-b border-ink">
          {alias("pricing")}
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[20ch] text-title font-bold">{t("pricingStrip.title")}</h2>
            <p className="mt-6 max-w-[56ch] text-lead text-ink-soft">{t("pricingStrip.body")}</p>
            <ul aria-label={t("pricingStrip.caption")} className="mt-12 grid border-t border-l border-ink sm:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((plan) => (
                <li key={plan} className={`flex flex-col border-r border-b border-ink p-5 ${plan === "team" ? "bg-sheet" : ""}`}>
                  <h3 className="condensed text-[2rem] leading-none font-extrabold tracking-[-0.03em]">{tp(`plans.${plan}.name`)}</h3>
                  <p className="mt-3 font-mono text-small">{planPrice[plan]}</p>
                  <p className="mt-3 flex-1 text-body text-ink-soft">{t(`pricingStrip.${plan}`)}</p>
                  <a
                    href={plan === "enterprise" ? `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(t("pricingStrip.mailSubject"))}` : appUrl(locale)}
                    className={`${plan === "team" ? BUTTON_INK : BUTTON_OUTLINE} mt-6 h-11 text-small`}
                  >
                    {plan === "enterprise" ? t("pricingStrip.enterpriseAction") : ts("submit")}
                    <Icon name="arrow" className={ARROW} />
                  </a>
                </li>
              ))}
            </ul>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
              <p className="max-w-[56ch] text-body">{t("pricingStrip.addon")}</p>
              <Link href="/pricing" className="shrink-0 text-body font-semibold underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink">
                {t("pricingStrip.details")}
                <Icon name="arrow" className="ml-2 inline size-4 align-[-0.15em]" />
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ, mirrored as FAQPage structured data. */}
        <section id={anchors.faq} className="scroll-mt-14 border-b border-ink">
          {alias("faq")}
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
                    text: t.markup(`faq.${item}.a`, {
                      subprocessors: (chunks) => chunks,
                      privacy: (chunks) => chunks,
                      security: (chunks) => chunks,
                    }),
                  },
                })),
              }).replace(/</g, "\\u003c"),
            }}
          />
          <div className={`${WRAP} ${SPLIT}`}>
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
                      security: (chunks) => (
                        <Link href="/security" className="font-medium text-ink underline underline-offset-4">
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

        {/* Close: the hero's field, once more, with the same promise underneath. */}
        <section>
          <div className={`${WRAP} grid gap-10 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end lg:gap-16`}>
            <h2 className="condensed max-w-[16ch] text-display font-extrabold">{t("final")}</h2>
            <div>
              <SignupForm id="email-final" locale={locale} />
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-small text-ink-soft">
                <span>{t("hero.free")}</span>
                <span>{t("hero.noCard")}</span>
                <Link href="/security" className="underline-offset-4 hover:text-ink hover:underline">
                  {t("hero.europe")}
                </Link>
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter locale={locale} path="/" />
    </div>
  );
}
