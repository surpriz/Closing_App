import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { SignupForm } from "@/components/signup-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { HeatScale } from "@/components/thermal-plate";
import type { Messages } from "@/i18n/messages";
import { Link } from "@/i18n/navigation";
import { resolveLocale } from "@/i18n/page";
import type { Locale } from "@/i18n/routing";
import { alternatesFor, localizedPath } from "@/i18n/seo";

type CaseKey = keyof Messages["useCases"]["cases"];
type Format = "pdf" | "video" | "web" | "smart" | "capsule" | "any" | "team";

// Copy lives in messages/<locale>.json under "useCases"; this sets the order and what each case sends.
// Every case is a feature in production; the format tag says what goes out.
const MOMENTS: { key: "prospect" | "propose" | "close" | "manage"; cases: [CaseKey, Format][] }[] = [
  { key: "prospect", cases: [["fair", "video"], ["cold", "smart"], ["chat", "any"]] },
  {
    key: "propose",
    cases: [["sleeping", "pdf"], ["decider", "pdf"], ["price", "capsule"], ["abroad", "pdf"], ["web", "web"], ["demo", "video"]],
  },
  { key: "close", cases: [["adjust", "pdf"], ["tech", "pdf"], ["ready", "pdf"]] },
  { key: "manage", cases: [["review", "team"]] },
];

const MOMENT_IDS: Record<Locale, Record<(typeof MOMENTS)[number]["key"], string>> = {
  fr: { prospect: "prospecter", propose: "proposer", close: "conclure", manage: "piloter" },
  en: { prospect: "prospect", propose: "propose", close: "close", manage: "manage" },
};

// Where Clozer sits next to a cold email tool: heat starts when the prospect reads.
const WORKFLOW = [
  { key: "sequence", clozer: false },
  { key: "read", clozer: true },
  { key: "clozer", clozer: true },
  { key: "crm", clozer: false },
] as const;
const WORKFLOW_ID: Record<Locale, string> = { fr: "ou-se-place-clozer", en: "where-clozer-fits" };

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await resolveLocale(params);
  const t = await getTranslations({ locale, namespace: "useCases" });
  const title = `Clozer · ${t("title")}`;
  return {
    title,
    description: t("description"),
    alternates: alternatesFor(locale, "/use-cases"),
    openGraph: { title, description: t("description"), url: localizedPath(locale, "/use-cases") },
    twitter: { title, description: t("description") },
  };
}

const WRAP = "mx-auto w-full max-w-[90rem] px-5 sm:px-8";

export default async function UseCases({ params }: Props) {
  const locale = await resolveLocale(params);
  const [t, th] = await Promise.all([
    getTranslations({ locale, namespace: "useCases" }),
    getTranslations({ locale, namespace: "home" }),
  ]);
  const ids = MOMENT_IDS[locale];

  return (
    <div className="flex min-h-full flex-col overflow-x-clip">
      <SiteHeader locale={locale} path="/use-cases" />

      <main className="flex-1">
        <section className="border-b border-ink">
          <div className={`${WRAP} pt-10 pb-12 sm:pt-14 md:pb-16 lg:pt-20`}>
            <h1 className="condensed max-w-[16ch] text-[2.625rem] leading-[0.95] font-extrabold tracking-[-0.03em] sm:text-display">
              {t("heading")}
            </h1>
            <p className="mt-6 max-w-[58ch] text-body text-ink-soft sm:mt-8 sm:text-lead">{t("lead")}</p>
            <nav aria-label={t("jump")} className="mt-10 grid grid-cols-2 border-t border-l border-ink sm:grid-cols-4">
              {MOMENTS.map((moment, index) => (
                <a
                  key={moment.key}
                  href={`#${ids[moment.key]}`}
                  className="flex items-baseline justify-between gap-3 border-r border-b border-ink px-4 py-3 transition-colors hover:bg-sheet"
                >
                  <span className="font-semibold">{t(`moments.${moment.key}.title`)}</span>
                  <span className="font-mono text-micro text-ink-soft">
                    {String(index + 1).padStart(2, "0")} · {moment.cases.length}
                  </span>
                </a>
              ))}
            </nav>
          </div>
        </section>

        {/* The handoff from the cold email tool, before the cases: one picture of where Clozer starts. */}
        <section id={WORKFLOW_ID[locale]} className="scroll-mt-14 border-b border-ink bg-sheet">
          <div className={`${WRAP} py-16 md:py-20`}>
            <h2 className="condensed max-w-[24ch] text-title font-bold">{t("workflow.title")}</h2>
            <p className="mt-4 max-w-[60ch] text-lead text-ink-soft">{t("workflow.body")}</p>
            <figure className="mt-10">
              <figcaption className="sr-only">{t("workflow.caption")}</figcaption>
              <ol className="grid border-t border-l border-ink sm:grid-cols-2 lg:grid-cols-4">
                {WORKFLOW.map((step, index) => (
                  <li key={step.key} className="flex flex-col border-r border-b border-ink">
                    {step.clozer ? (
                      <HeatScale orientation="horizontal" className="[&>div]:h-1.5" />
                    ) : (
                      <span aria-hidden className="h-1.5 bg-rule" />
                    )}
                    <div className="p-5">
                      <p className="flex items-baseline justify-between gap-3 font-mono text-micro text-ink-soft">
                        <span>{t(`workflow.${step.key}.who`)}</span>
                        <span>{index + 1}/{WORKFLOW.length}</span>
                      </p>
                      <h3 className="condensed mt-3 text-[1.5rem] leading-tight font-bold tracking-[-0.02em]">
                        {t(`workflow.${step.key}.title`)}
                      </h3>
                      <p className="mt-2 text-body text-ink-soft">{t(`workflow.${step.key}.body`)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </figure>
            <p className="mt-6 max-w-[64ch] text-body">{t("workflow.scope")}</p>
          </div>
        </section>

        {MOMENTS.map((moment, index) => (
          <section
            key={moment.key}
            id={ids[moment.key]}
            className={`scroll-mt-14 border-b border-ink ${index % 2 ? "bg-sheet" : ""}`}
          >
            <div className={`${WRAP} grid gap-8 py-16 md:py-20 lg:grid-cols-[minmax(0,4fr)_minmax(0,8fr)] lg:gap-20`}>
              <div className="lg:sticky lg:top-24 lg:self-start">
                <span className="font-mono text-small text-ink-soft">{String(index + 1).padStart(2, "0")}</span>
                <h2 className="condensed mt-2 text-title font-bold">{t(`moments.${moment.key}.title`)}</h2>
                <p className="mt-3 text-lead text-ink-soft">{t(`moments.${moment.key}.body`)}</p>
              </div>
              <ol className="border-t border-ink">
                {moment.cases.map(([key, format]) => (
                  <li key={key} className="border-b border-rule py-8">
                    <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
                      <h3 className="condensed max-w-[28ch] text-[1.5rem] leading-tight font-bold tracking-[-0.02em]">
                        {t(`cases.${key}.title`)}
                      </h3>
                      <span
                        className={`shrink-0 border px-2 py-1 font-mono text-micro ${
                          format === "video" ? "border-ink bg-ink text-sheet" : "border-rule text-ink-soft"
                        }`}
                      >
                        {t(`formats.${format}`)}
                        {format === "video" && <HeatScale orientation="horizontal" className="mt-1 [&>div]:h-0.5" />}
                      </span>
                    </div>
                    <dl className="mt-4 grid gap-4 sm:grid-cols-2 sm:gap-8">
                      <div>
                        <dt className="font-mono text-micro text-ink-soft">{t("send")}</dt>
                        <dd className="mt-1 max-w-[46ch] text-body">{t(`cases.${key}.send`)}</dd>
                      </div>
                      <div>
                        <dt className="font-mono text-micro text-ink-soft">{t("result")}</dt>
                        <dd className="mt-1 max-w-[46ch] text-body">{t(`cases.${key}.result`)}</dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
            </div>
          </section>
        ))}

        {/* Close: the same field as the home page. */}
        <section>
          <div className={`${WRAP} grid gap-10 py-20 md:py-28 lg:grid-cols-[minmax(0,1fr)_26rem] lg:items-end lg:gap-16`}>
            <h2 className="condensed max-w-[18ch] text-title font-extrabold sm:text-[clamp(2.5rem,1.4rem+3vw,4.5rem)] sm:leading-[0.95]">
              {t("final")}
            </h2>
            <div>
              <SignupForm id="email-use-cases" locale={locale} />
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

      <SiteFooter locale={locale} path="/use-cases" />
    </div>
  );
}
