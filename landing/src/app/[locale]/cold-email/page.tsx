import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { Icon } from "@/components/icons";
import { Logo } from "@/components/logo";
import { SignupForm } from "@/components/signup-form";
import { HeatScale } from "@/components/thermal-plate";
import { ThermalReading } from "@/components/thermal-reading";
import { READING_PAGES } from "@/components/thermal-reading-data";
import { COLD_OFFER, PROPALE } from "@/content/propale";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/page";
import type { Locale } from "@/i18n/routing";
import { localizedPath } from "@/i18n/seo";

// Campaign values copied from the page URL to /login, so the signup is attributed to its campaign.
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const;

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/** French only: any other locale is a 404. */
async function frenchOnly(params: Props["params"]): Promise<Locale> {
  const locale = await resolveLocale(params);
  if (locale !== "fr") notFound();
  return locale;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await frenchOnly(params);
  const { title, description } = PROPALE.meta;
  const url = localizedPath(locale, "/cold-email");
  return {
    title,
    description,
    // Campaign page: reached from the emails only, never from search.
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: { title, description, url },
    twitter: { title, description },
  };
}

// The display copy lives in content/propale.ts, not in messages, so <hot> is parsed here.
function withHot(text: string) {
  return text.split(/(<hot>.*?<\/hot>)/).map((part, i) => {
    const hot = part.match(/^<hot>(.*)<\/hot>$/);
    if (!hot) return part;
    return (
      <span key={i} className="relative inline-block">
        {hot[1]}
        <HeatScale orientation="horizontal" className="absolute inset-x-0 -bottom-1.5 sm:-bottom-3" />
      </span>
    );
  });
}

// Read per request (the page is dynamic through searchParams), so the offer closes on time.
function offerOpen() {
  return new Date() <= COLD_OFFER.deadline;
}

const WRAP = "mx-auto w-full max-w-[90rem] px-5 sm:px-8";

export default async function ColdEmail({ params, searchParams }: Props) {
  const locale = await frenchOnly(params);
  const [query, tr, tf] = await Promise.all([
    searchParams,
    getTranslations({ locale, namespace: "reading" }),
    getTranslations({ locale, namespace: "footer" }),
  ]);

  const open = offerOpen();
  const extraParams: Record<string, string> = open ? { offer: COLD_OFFER.code } : {};
  for (const key of UTM_KEYS) {
    const value = query[key];
    const first = Array.isArray(value) ? value[0] : value;
    if (first) extraParams[key] = first.slice(0, 200);
  }

  const pages = READING_PAGES.map((page) => ({
    label: tr(`pages.${page.key}.label`),
    heading: tr(`pages.${page.key}.heading`),
    time: page.time,
    heat: page.heat,
  }));

  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      {/* Logo only, not linked: the visitor stays on this page. */}
      <header className="border-b border-ink">
        <div className={`${WRAP} flex h-14 items-center justify-between gap-6`}>
          <Logo />
          <p className="max-w-[15rem] text-right font-mono text-micro text-ink-soft sm:max-w-none">{PROPALE.hero.kicker}</p>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero: the scene, the offer, the signup. Held tight so all of it fits the first phone screen. */}
        <section className="border-b border-ink">
          <div className={`${WRAP} grid grid-cols-[minmax(0,1fr)] gap-6 pt-6 pb-10 sm:gap-10 sm:pt-12 md:pb-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-16 lg:pt-16 lg:pb-20`}>
            <div>
              <h1 className="condensed text-[2.125rem] leading-[0.98] font-extrabold tracking-[-0.03em] sm:text-display lg:text-[clamp(3rem,1rem+3.4vw,4.5rem)]">
                {withHot(PROPALE.hero.title)}
              </h1>
              <p className="mt-5 max-w-[54ch] text-body text-ink-soft sm:mt-8 sm:text-lead">{PROPALE.hero.lead}</p>
            </div>
            <div className="w-full max-w-[28rem]">
              <OfferBlock open={open} />
              <SignupForm id="email-hero" locale={locale} extraParams={extraParams} submitLabel={PROPALE.hero.cta} />
              {open && <p className="mt-3 max-w-[48ch] text-small text-ink-soft">{PROPALE.offer.earlyPay}</p>}
            </div>
          </div>
        </section>

        {/* The example reading: the hero's scene, page by page. */}
        <section className="border-b border-ink bg-sheet">
          <Strip label={PROPALE.example.kicker} index={1} />
          <div className={`${WRAP} grid gap-12 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-20`}>
            <div>
              <h2 className="condensed max-w-[16ch] text-title font-bold">{withHot(PROPALE.example.title)}</h2>
              <p className="mt-8 flex items-center gap-3 text-lead font-semibold">
                <span aria-hidden className="size-2.5 shrink-0 bg-iron-2" />
                {PROPALE.example.verdict}
              </p>
            </div>
            <ThermalReading
              name={tr("name")}
              caption={tr("caption")}
              summary={tr("summary")}
              pages={pages}
              labels={{ example: PROPALE.example.note, hot: tr("hot"), cold: tr("cold") }}
            />
          </div>
        </section>

        <section className="border-b border-ink">
          <Strip label={PROPALE.gains.kicker} index={2} />
          <div className={`${WRAP} py-20 md:py-28`}>
            <h2 className="condensed max-w-[20ch] text-title font-bold">{withHot(PROPALE.gains.title)}</h2>
            <ul className="mt-12 grid border-t border-ink md:mt-14 md:grid-cols-2">
              {PROPALE.gains.items.map((item, index) => (
                <li key={item.title} className="border-b border-rule py-8 md:odd:pr-10 md:even:border-l md:even:pl-10">
                  <span className="font-mono text-small text-ink-soft">
                    {index + 1}/{PROPALE.gains.items.length}
                  </span>
                  <h3 className="condensed mt-3 text-[1.75rem] leading-tight font-bold tracking-[-0.02em]">{item.title}</h3>
                  <p className="mt-3 max-w-[52ch] text-body text-ink-soft">{item.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-ink">
          <Strip label={PROPALE.manager.kicker} index={3} />
          <div className={`${WRAP} grid gap-8 py-20 md:py-28 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <h2 className="condensed max-w-[20ch] text-title font-bold">{withHot(PROPALE.manager.title)}</h2>
            <p className="max-w-[58ch] text-lead text-ink-soft lg:pt-2">{PROPALE.manager.body}</p>
          </div>
        </section>

        <section className="border-b border-ink">
          <Strip label={PROPALE.faq.kicker} index={4} heading />
          <div className={`${WRAP} py-12 md:py-20 lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-20`}>
            <div className="border-t border-ink lg:col-start-2">
              {PROPALE.faq.items.map((item) => (
                <details key={item.q} className="group border-b border-rule">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-[1.125rem] font-semibold [&::-webkit-details-marker]:hidden">
                    {item.q}
                    <Icon
                      name="plus"
                      className="size-5 shrink-0 transition-transform duration-300 ease-[var(--ease-out-expo)] group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-[62ch] pb-6 text-body text-ink-soft">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Close: the offer again, with the second form. */}
        <section>
          <div className={`${WRAP} grid gap-10 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-end lg:gap-16`}>
            <div>
              <h2 className="condensed max-w-[16ch] text-display font-extrabold">{withHot(PROPALE.final.title)}</h2>
              <p className="mt-6 max-w-[52ch] text-lead text-ink-soft">{PROPALE.final.lead}</p>
            </div>
            <div>
              <OfferBlock open={open} detailed />
              <SignupForm id="email-final" locale={locale} extraParams={extraParams} submitLabel={PROPALE.final.cta} />
            </div>
          </div>
        </section>
      </main>

      {/* Legal links only: no way back into the rest of the site. */}
      <footer className="border-t border-ink">
        <div className={`${WRAP} flex flex-wrap gap-x-6 gap-y-2 py-8 text-small text-ink-soft`}>
          <Link href="/legal" className="underline-offset-4 transition-colors hover:text-ink hover:underline">
            {tf("legal")}
          </Link>
          <Link href="/privacy" className="underline-offset-4 transition-colors hover:text-ink hover:underline">
            {tf("privacy")}
          </Link>
        </div>
      </footer>
    </div>
  );
}

/** Report header strip of a section: its name, and its place in the report. */
function Strip({ label, index, heading = false }: { label: string; index: number; heading?: boolean }) {
  const Label = heading ? "h2" : "p";
  return (
    <div className="border-b border-rule">
      <div className={`${WRAP} flex items-baseline justify-between gap-6 py-2.5 font-mono text-micro text-ink-soft`}>
        <Label className="font-normal">{label}</Label>
        <span aria-hidden>{String(index).padStart(2, "0")}/04</span>
      </div>
    </div>
  );
}

/**
 * The offer field, sitting on top of the signup box (they share its border).
 * Past the deadline it turns into the standard trial, so the page stays true without a redeploy.
 */
function OfferBlock({ open, detailed = false }: { open: boolean; detailed?: boolean }) {
  return (
    <div className="border border-b-0 border-ink bg-sheet">
      <p className="border-b border-ink px-4 py-2.5 text-micro font-medium tracking-[0.06em] uppercase">
        {open ? PROPALE.offer.label : PROPALE.offerExpired.label}
      </p>
      {open ? (
        <div className="grid gap-1 px-4 py-3">
          <p className="text-body leading-snug font-semibold">{PROPALE.offer.trial}</p>
          <p className="text-small text-ink-soft">{PROPALE.offer.discount}</p>
          {detailed && <p className="text-small text-ink-soft">{PROPALE.offer.earlyPay}</p>}
          <p className="mt-1 font-mono text-micro">{PROPALE.offer.deadline}</p>
        </div>
      ) : (
        <div className="grid gap-1 px-4 py-3">
          <p className="text-body leading-snug font-semibold">{PROPALE.offerExpired.trial}</p>
          <p className="text-small text-ink-soft">{PROPALE.offerExpired.note}</p>
        </div>
      )}
    </div>
  );
}
