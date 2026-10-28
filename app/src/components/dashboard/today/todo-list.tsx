import { ArrowRight, ChevronDown, Sparkles } from "lucide-react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";

import { buttonVariants } from "@/components/ui/button";
import type { EngagementTier } from "@/generated/prisma/enums";
import {
  describeNextAction,
  isLive,
  isUrgent,
  type NextAction,
  type OpenDealStatus,
} from "@/lib/closing/dashboard/next-action";
import type { PageHeat } from "@/lib/closing/dashboard/page-heat";
import { tidyEllipsis } from "@/lib/clip-text";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CopyButton } from "../copy-button";
import { MarkWonButton } from "../mark-won-button";
import { LiveDot } from "../heat";
import { SentQuestion } from "./ready-links";
import { HeatStrip } from "../heat-strip";

export type TodoRow = {
  id: string;
  dealStatus: OpenDealStatus;
  /** At least one reading session, bots aside. */
  opened: boolean;
  label: string;
  /** Company when known, else the contact. */
  company: string | null;
  contact: string | null;
  /** Null when the label already names the document. */
  documentName: string | null;
  tier: EngagementTier | null;
  score: number;
  /** "Chaud", "Ajustement demandé", "Pas encore ouvert"… */
  state: string;
  lastActivityAt: Date | null;
  action: NextAction;
  /** One-line AI reading of the deal, when it still matches the latest reading. */
  insightHeadline: string | null;
  /** 1-5 from the same analysis, null when it is missing or stale. */
  aiPriority: number | null;
  url: string;
  /** What the prospect clicks on once pasted in an email. */
  title: string;
  /** Reading time per page as a thermal strip, null when the link was never opened. */
  heat: PageHeat | null;
};

const TIER_SWATCH: Record<EngagementTier, string> = {
  HOT: "bg-heat-hot",
  WARM: "bg-heat-warm",
  COLD: "bg-heat-cold",
};

/** Open deals, most urgent first: each one's pages at the thermal camera, and the next thing to do. */
export function TodoList({
  rows,
  now,
  headlineDealId = null,
}: {
  rows: TodoRow[];
  now: Date;
  /** The deal the page title already quotes: its AI line is left out here. */
  headlineDealId?: string | null;
}) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <ul className="stagger divide-y divide-border border-y border-foreground bg-card">
      {rows.map((row, index) => {
        const read =
          isLive(row.action)
            ? t("today.todo.readingNow")
            : row.lastActivityAt
              ? t("today.todo.readAgo", { when: formatRelative(row.lastActivityAt, locale, now) })
              : null;
        const urgent = isUrgent(row.action);
        const meta = [
          row.contact && row.contact !== row.label ? row.contact : null,
          row.documentName,
        ]
          .filter(Boolean)
          .join(" · ");
        return (
          <li
            key={row.id}
            className="group relative grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-3 px-3 py-4 transition-colors duration-150 hover:bg-muted/60 sm:grid-cols-[7.25rem_minmax(0,1fr)_auto] sm:px-4"
          >
            <HeatStrip heat={row.heat} className="col-span-2 sm:col-span-1" />
            <div className="min-w-0 space-y-1.5">
              {/* Temperature first: the word and its colour, the one signal the row is read for */}
              <div className="flex items-center gap-x-3">
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-sm bg-muted px-2 py-0.5 text-small",
                    row.tier || row.dealStatus !== "OPEN"
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "size-2",
                      row.dealStatus === "VALIDATED"
                        ? "bg-success"
                        : row.tier
                          ? TIER_SWATCH[row.tier]
                          : "bg-foreground/25",
                    )}
                  />
                  {row.state}
                </span>
                <Link
                  href={`/links/${row.id}`}
                  className="min-w-0 truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                >
                  {row.label}
                </Link>
                {read && (
                  <span className="shrink-0 text-small text-muted-foreground">
                    {read}
                  </span>
                )}
              </div>
              {(meta || row.heat?.hottest) && (
                <p className="flex flex-wrap gap-x-2 text-small text-muted-foreground">
                  {row.heat?.hottest && (
                    <span className="text-foreground">
                      {t.rich("today.todo.hottestPage", {
                        page: row.heat.hottest.page,
                        duration: formatSeconds(row.heat.hottest.seconds),
                        b: (chunks) => <span className="font-medium">{chunks}</span>,
                      })}
                    </span>
                  )}
                  {meta && <span className="truncate">{meta}</span>}
                </p>
              )}
              <p
                className={cn(
                  "flex items-start gap-2 text-body",
                  urgent ? "font-semibold" : "text-foreground/80",
                )}
              >
                {isLive(row.action) ? (
                  <LiveDot className="mt-1.5 size-2 shrink-0" />
                ) : (
                  <ArrowRight className="mt-1 size-4 shrink-0" aria-hidden />
                )}
                <span>{describeNextAction(row.action, now, { t, locale })}</span>
              </p>
              {row.insightHeadline && row.id !== headlineDealId && (
                <p
                  className="flex items-start gap-1.5 text-small text-muted-foreground"
                  title={row.insightHeadline}
                >
                  <Sparkles
                    className="mt-0.5 size-3.5 shrink-0"
                    aria-label={t("today.todo.aiAnalysis")}
                  />
                  <span className="line-clamp-2">
                    {tidyEllipsis(row.insightHeadline)}
                  </span>
                </p>
              )}
            </div>
            <div className="relative z-10 flex flex-col items-end gap-2">
              {row.action.kind === "close_won" ? (
                <MarkWonButton linkId={row.id} />
              ) : (
                <CopyButton value={row.url} title={row.title} />
              )}
              {index === 0 && (
                <Link
                  href={`/links/${row.id}`}
                  className={buttonVariants({ size: "sm" })}
                >
                  {t("today.todo.handle")}
                  <ArrowRight data-icon="inline-end" />
                </Link>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export type UnopenedRow = {
  id: string;
  label: string;
  documentName: string | null;
  url: string;
  /** What the prospect clicks on once pasted in an email. */
  title: string;
  /** Copied a while ago, never opened: ask whether it really went out. */
  askIfSent?: boolean;
};

/**
 * Links nobody has opened yet, sent or copied: one folded line instead of a column of identical rows.
 * It opens on its own when one of them needs an answer.
 */
export function UnopenedDeals({ rows }: { rows: UnopenedRow[] }) {
  const t = useTranslations("today.todo");
  const asking = rows.some((row) => row.askIfSent);
  return (
    <details open={asking} className="group mt-4 border-y border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-3 text-body [&::-webkit-details-marker]:hidden">
        <span>
          <span className="font-semibold">
            {t("unopenedCount", { count: rows.length })}
          </span>{" "}
          <span className="text-muted-foreground">
            {t("unopenedHint")}
          </span>
        </span>
        <ChevronDown
          className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <ul className="divide-y divide-border border-t border-border">
        {rows.map((row) => (
          <li
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5"
          >
            <span className="min-w-0 truncate text-small">
              <Link
                href={`/links/${row.id}`}
                className="font-medium hover:underline"
              >
                {row.label}
              </Link>
              {row.documentName && (
                <span className="text-muted-foreground">
                  {" "}
                  · {row.documentName}
                </span>
              )}
            </span>
            {row.askIfSent ? (
              <SentQuestion linkId={row.id} />
            ) : (
              <CopyButton value={row.url} title={row.title} />
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function formatSeconds(seconds: number) {
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")}`;
}
