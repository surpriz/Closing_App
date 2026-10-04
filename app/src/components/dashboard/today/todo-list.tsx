import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";

import type { EngagementTier } from "@/generated/prisma/enums";
import { describeNextAction, isUrgent, type NextAction } from "@/lib/closing/dashboard/next-action";
import { formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

import { CopyButton } from "../copy-button";
import { HeatBar, LiveDot } from "../heat";

export type TodoRow = {
  id: string;
  dealStatus: "OPEN" | "CHANGE_REQUESTED";
  /** At least one reading session, bots aside. */
  opened: boolean;
  label: string;
  /** Company when known, else the contact. */
  company: string | null;
  contact: string | null;
  documentName: string;
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
};

const TIER_DOT: Record<EngagementTier, string> = {
  HOT: "bg-heat-hot",
  WARM: "bg-heat-warm",
  COLD: "bg-heat-cold",
};

/** Open deals, most urgent first, each with the next thing to do. */
export function TodoList({ rows, now }: { rows: TodoRow[]; now: Date }) {
  return (
    <ul className="stagger divide-y divide-border overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border">
      {rows.map((row) => {
        const read =
          row.action.kind === "call_now"
            ? "en ce moment"
            : row.lastActivityAt
              ? `lu ${formatRelative(row.lastActivityAt, now)}`
              : null;
        const urgent = isUrgent(row.action);
        const meta = [row.company && row.contact ? row.contact : null, row.documentName].filter(Boolean).join(" · ");
        return (
          <li
            key={row.id}
            className="group relative flex items-stretch gap-4 py-4 pr-3 pl-4 transition-colors duration-150 hover:bg-muted/40"
          >
            <HeatBar tier={row.tier} score={row.score} />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                <Link
                  href={`/links/${row.id}`}
                  className="min-w-0 truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                >
                  {row.label}
                </Link>
                <span className="flex shrink-0 items-center gap-1.5 text-small text-muted-foreground">
                  <span
                    aria-hidden
                    className={cn(
                      "size-1.5 rounded-full",
                      row.tier ? TIER_DOT[row.tier] : row.dealStatus === "CHANGE_REQUESTED" ? "bg-brand" : "bg-foreground/20",
                    )}
                  />
                  <span className={cn(row.tier || row.dealStatus !== "OPEN" ? "font-medium text-foreground" : "")}>
                    {row.state}
                  </span>
                  {read && <span>· {read}</span>}
                </span>
              </div>
              <p className="truncate text-small text-muted-foreground">{meta}</p>
              <p
                className={cn(
                  "inline-flex max-w-full items-start gap-2 rounded-md px-2 py-1 text-sm",
                  urgent ? "bg-foreground text-background" : "bg-muted text-foreground",
                )}
              >
                {row.action.kind === "call_now" ? (
                  <LiveDot className="mt-1.5 size-2 shrink-0" />
                ) : (
                  <ArrowRight className="mt-0.5 size-3.5 shrink-0 opacity-70" aria-hidden />
                )}
                <span>{describeNextAction(row.action, now)}</span>
              </p>
              {row.insightHeadline && (
                <p className="flex items-start gap-1.5 text-small text-muted-foreground" title={row.insightHeadline}>
                  <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" aria-label="Analyse IA" />
                  <span className="line-clamp-2">{row.insightHeadline}</span>
                </p>
              )}
            </div>
            <div className="relative z-10 flex items-start pt-0.5">
              <CopyButton value={row.url} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
