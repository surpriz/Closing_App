import { ArrowLeft, Hourglass } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { INTL_LOCALE } from "@/i18n/locale";
import { formatClock } from "@/lib/closing/dashboard/deal-plates";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { ArchiveLinkButton } from "../archive-link-button";
import { CopyButton } from "../copy-button";
import { DealStatusSelect } from "../deal-status-select";
import { HeatDot, HeatPill } from "../heat";
import type { Deal } from "./load-deal";

/**
 * Top of the prospect's report: the reading's reference fields, the prospect
 * as the title, its temperature and the link it reads through.
 */
export function DealHeader({ deal }: { deal: Deal }) {
  const {
    link,
    analytics,
    now,
    url,
    title,
    contactLine,
    canEdit,
    seller,
    score,
  } = deal;
  const t = useTranslations("deal.dealHeader");
  const tl = useTranslations("labels");
  const locale = useLocale();
  const reportDate = new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const expired = !!link.expiresAt && link.expiresAt <= now;

  return (
    <header className="space-y-5">
      <Link
        href={`/documents/${link.document.id}`}
        className="inline-flex max-w-full items-center gap-1.5 text-small text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:underline"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        <span className="truncate">{link.document.name}</span>
      </Link>

      <p className="flex flex-wrap gap-x-6 gap-y-1 border-b border-border pb-2 font-mono text-micro text-muted-foreground">
        <span className="text-foreground">{t("report")}</span>
        <span>
          {link.draftAt
            ? t("notSent")
            : t("sentOn", {
                date: reportDate.format(link.sentAt ?? link.createdAt),
              })}
        </span>
        <span>{t("reads", { count: analytics.viewCount })}</span>
        {analytics.totalDurationMs > 0 && (
          <span>
            {t("total", {
              time: formatClock(analytics.totalDurationMs / 1000),
            })}
          </span>
        )}
        {deal.readingNow ? (
          <span className="text-foreground">{t("readingNow")}</span>
        ) : (
          analytics.lastActivityAt && (
            <span>
              {t("lastRead", {
                when: formatRelative(analytics.lastActivityAt, locale, now),
              })}
            </span>
          )
        )}
      </p>

      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div className="min-w-0 space-y-3">
          <h1 className="condensed text-title break-words text-balance sm:text-display">
            {title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-body">
            {deal.opened && score ? (
              <HeatDot
                tier={score.tier}
                score={score.score}
                reasons={score.reasons}
                className="text-body font-medium"
              />
            ) : (
              !deal.opened && <HeatPill tier={null} />
            )}
            {contactLine && (
              <span className="min-w-0 truncate text-muted-foreground">
                {contactLine}
              </span>
            )}
            {link.parentLink && (
              <Link
                href={`/links/${link.parentLink.id}`}
                className="text-muted-foreground hover:text-foreground hover:underline"
              >
                {link.parentLink.name
                  ? t("viaSharedNamed", { name: link.parentLink.name })
                  : t("viaShared")}
              </Link>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-small text-muted-foreground">
            <span className="inline-flex h-7 max-w-full min-w-0 items-center gap-0.5 rounded-sm border border-border bg-card pr-0.5 pl-2 font-mono">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="truncate hover:text-foreground hover:underline"
              >
                {url.replace(/^https?:\/\//, "")}
              </a>
              <CopyButton
                value={url}
                draftLinkId={canEdit && link.draftAt ? link.id : undefined}
              />
            </span>
            {link.expiresAt && canEdit && (
              <a
                href="#expiration"
                className={cn(
                  "inline-flex h-7 items-center gap-1 rounded-sm border border-border px-2 hover:text-foreground hover:underline",
                  expired && "text-destructive",
                )}
              >
                <Hourglass className="size-3.5" aria-hidden />
                {expired
                  ? t("expiredAgo", {
                      when: formatRelative(link.expiresAt, locale, now),
                    })
                  : t("expiresIn", {
                      when: formatRelative(link.expiresAt, locale, now),
                    })}
              </a>
            )}
          </div>
        </div>
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            {!link.shared && (
              <DealStatusSelect linkId={link.id} status={link.dealStatus} />
            )}
            <ArchiveLinkButton linkId={link.id} />
          </div>
        ) : (
          <span className="text-small text-muted-foreground">
            {tl(`dealStatus.${link.dealStatus}`)}
          </span>
        )}
      </div>

      {!canEdit && (
        <p className="bg-muted px-4 py-3 text-small text-muted-foreground">
          {t("readOnly", {
            seller: seller?.name || seller?.email || t("anotherSeller"),
          })}
        </p>
      )}
      {expired && (
        <a
          href="#expiration"
          className="flex items-center gap-2 bg-destructive/10 px-4 py-3 text-small text-destructive hover:underline"
        >
          <Hourglass className="size-4 shrink-0" aria-hidden />
          {t("expiredBanner")}
        </a>
      )}
    </header>
  );
}
