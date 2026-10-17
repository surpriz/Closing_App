import {
  BellRing,
  Eye,
  FileSearch,
  Gauge,
  type LucideIcon,
  MailCheck,
  PenLine,
  ShieldCheck,
  Sparkles,
  Timer,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

import { PageHeader, SectionTitle, Surface } from "@/components/dashboard/page-header";
import { buttonVariants } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("help.howItWorks");
  return { title: t("metaTitle") };
}

const STEPS = [
  { icon: FileSearch, id: "read" },
  { icon: Eye, id: "open" },
  { icon: Sparkles, id: "analyze" },
  { icon: PenLine, id: "write" },
  { icon: Timer, id: "timing" },
  { icon: MailCheck, id: "approve" },
  { icon: BellRing, id: "watch" },
] as const satisfies { icon: LucideIcon; id: string }[];

const GUARDRAILS = ["noHint", "noInvented", "cap", "timing", "single", "privateNotes"] as const;

function Step({ icon: Icon, id, index }: (typeof STEPS)[number] & { index: number }) {
  const t = useTranslations("help.howItWorks.steps");
  return (
    <li className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 py-5">
      <span className="flex flex-col items-center gap-1.5">
        <span className="flex size-10 items-center justify-center border border-border bg-card">
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span className="font-mono text-micro text-muted-foreground tabular-nums">
          {index}/{STEPS.length}
        </span>
      </span>
      <div className="space-y-1 pt-2">
        <h3 className="text-body font-semibold">{t(`${id}.title`)}</h3>
        <p className="text-body text-muted-foreground">{t(`${id}.body`)}</p>
      </div>
    </li>
  );
}

export default async function HowItWorksPage() {
  const t = await getTranslations("help.howItWorks");
  const strong = (chunks: React.ReactNode) => <span className="text-foreground">{chunks}</span>;
  return (
    <div className="max-w-3xl space-y-12">
      <PageHeader
        title={t("title")}
        description={t("description")}
        action={
          <>
            <Link href="/faq" className={buttonVariants({ variant: "outline" })}>
              {t("faq")}
            </Link>
            <Link href="/welcome" className={buttonVariants({ variant: "outline" })}>
              {t("replayTour")}
            </Link>
          </>
        }
      />

      <section>
        <p className="text-heading text-balance">{t("intro")}</p>
      </section>

      <section>
        <SectionTitle hint={t("journeyHint")}>{t("journeyTitle")}</SectionTitle>
        <ol className="divide-y divide-border">
          {STEPS.map((step, i) => (
            <Step key={step.id} {...step} index={i + 1} />
          ))}
        </ol>
      </section>

      <section>
        <SectionTitle>{t("indicatorsTitle")}</SectionTitle>
        <div className="grid gap-px border-y border-foreground bg-border sm:grid-cols-2 [&>*]:bg-card">
          <div className="space-y-2 p-5">
            <p className="flex items-center gap-2 text-body font-semibold">
              <Gauge className="size-4" aria-hidden /> {t("temperatureTitle")}
            </p>
            <p className="text-body text-muted-foreground">{t.rich("temperatureBody", { b: strong })}</p>
          </div>
          <div className="space-y-2 p-5">
            <p className="flex items-center gap-2 text-body font-semibold">
              <Sparkles className="size-4" aria-hidden /> {t("aiReadTitle")}
            </p>
            <p className="text-body text-muted-foreground">{t.rich("aiReadBody", { b: strong })}</p>
          </div>
        </div>
      </section>

      <section>
        <SectionTitle>{t("rulesTitle")}</SectionTitle>
        <Surface className="p-5">
          <ul className="space-y-2.5 text-body">
            {GUARDRAILS.map((rule) => (
              <li key={rule} className="flex gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                {t(`rules.${rule}`)}
              </li>
            ))}
          </ul>
        </Surface>
      </section>

      <section>
        <SectionTitle>{t("youTitle")}</SectionTitle>
        <ol className="list-inside list-decimal space-y-1.5 text-body">
          <li>
            {t.rich("you1", {
              link: (chunks) => (
                <Link href="/settings" className="underline underline-offset-4">
                  {chunks}
                </Link>
              ),
            })}
          </li>
          <li>{t("you2")}</li>
          <li>{t("you3")}</li>
          <li>{t("you4")}</li>
        </ol>
      </section>

      <section>
        <SectionTitle>{t("underTheHoodTitle")}</SectionTitle>
        <div className="space-y-2 text-body text-muted-foreground">
          <p>{t("underTheHood1")}</p>
          <p>{t("underTheHood2")}</p>
        </div>
      </section>

      <section>
        <SectionTitle>{t("notYetTitle")}</SectionTitle>
        <ul className="list-inside list-disc space-y-1.5 text-body text-muted-foreground">
          <li>{t("notYet1")}</li>
          <li>{t("notYet2")}</li>
          <li>{t("notYet3")}</li>
        </ul>
      </section>
    </div>
  );
}
