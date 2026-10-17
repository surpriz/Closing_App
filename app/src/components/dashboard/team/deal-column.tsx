import { ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import type { TeamDealRow } from "@/lib/closing/dashboard/team-queries";
import { formatRelative } from "@/lib/format";

import { HeatDot, HeatGauge } from "../heat";
import { describeHealthSignal } from "../labels";
import { SectionTitle } from "../page-header";
import { formatMoney } from "./money";

/** One column of the team page: its deals, best first, each with why it is there. */
export function DealColumn({
  title,
  hint,
  empty,
  rows,
  names,
  now,
  limit,
}: {
  title: string;
  hint: string;
  empty: string;
  rows: TeamDealRow[];
  /** Seller names, or null when the page shows a single seller. */
  names: Map<string, string> | null;
  now: Date;
  limit: number;
}) {
  const t = useTranslations("team.column");
  const tl = useTranslations("labels");
  const locale = useLocale();
  // Never-opened links have nothing to read off: one folded line, as on Aujourd'hui
  const waiting = rows.filter((row) => !row.tier && !row.lastActivityAt);
  const read = rows.filter((row) => row.tier || row.lastActivityAt);
  return (
    <section className="min-w-0">
      <SectionTitle hint={hint}>
        {title}{" "}
        <span className="font-normal text-muted-foreground tabular-nums">
          {rows.length}
        </span>
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="border border-dashed border-border px-4 py-6 text-small text-muted-foreground">
          {empty}
        </p>
      ) : (
        <>
          {read.length > 0 && (
            <ul className="stagger divide-y divide-border border-y border-foreground bg-card">
              {read.slice(0, limit).map((row) => {
                const meta = [
                  names && (names.get(row.sellerId) ?? t("formerMember")),
                  row.amountCents !== null &&
                    formatMoney(
                      { [row.currency ?? "EUR"]: row.amountCents },
                      locale,
                    ),
                  row.lastActivityAt
                    ? t("readAgo", {
                        when: formatRelative(row.lastActivityAt, locale, now),
                      })
                    : t("neverOpened"),
                ].filter(Boolean);
                return (
                  <li
                    key={row.id}
                    className="relative px-3.5 py-3.5 transition-colors duration-150 hover:bg-muted/60"
                  >
                    <div className="min-w-0 space-y-1.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          href={`/links/${row.id}`}
                          className="min-w-0 truncate text-body font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                        >
                          {row.label}
                        </Link>
                        {row.tier ? (
                          <HeatDot
                            tier={row.tier}
                            score={row.score}
                            className="shrink-0 text-small"
                          />
                        ) : (
                          <span className="shrink-0 text-small text-muted-foreground">
                            {t("notRead")}
                          </span>
                        )}
                      </div>
                      <HeatGauge
                        tier={row.tier}
                        score={row.score}
                        className="h-1"
                      />
                      <p className="truncate text-small text-muted-foreground">
                        {meta.join(" · ")}
                      </p>
                      <ul className="flex flex-wrap gap-1">
                        {row.signals.map((signal) => (
                          <li
                            key={signal.code}
                            className="rounded-sm bg-muted px-1.5 py-0.5 text-micro font-medium"
                          >
                            {describeHealthSignal(tl, locale, signal)}
                          </li>
                        ))}
                      </ul>
                      {row.insightHeadline && (
                        <p
                          className="flex items-start gap-1.5 text-small text-muted-foreground"
                          title={row.insightHeadline}
                        >
                          <Sparkles
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-label={t("aiAnalysis")}
                          />
                          <span className="line-clamp-2">
                            {row.insightHeadline}
                          </span>
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {waiting.length > 0 && (
            <details className="group mt-2 border-y border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-2.5 text-small [&::-webkit-details-marker]:hidden">
                <span>
                  <span className="font-semibold">
                    {t("waiting", { count: waiting.length })}
                  </span>
                </span>
                <ChevronDown
                  className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                  aria-hidden
                />
              </summary>
              <ul className="divide-y divide-border border-t border-border">
                {waiting.map((row) => (
                  <li key={row.id} className="truncate py-2 text-small">
                    <Link
                      href={`/links/${row.id}`}
                      className="font-medium hover:underline"
                    >
                      {row.label}
                    </Link>
                    {names && (
                      <span className="text-muted-foreground">
                        {" "}
                        · {names.get(row.sellerId) ?? t("formerMember")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {read.length > limit && (
        <p className="mt-2 text-small text-muted-foreground">
          {t("andMore", { count: read.length - limit })}
        </p>
      )}
    </section>
  );
}
