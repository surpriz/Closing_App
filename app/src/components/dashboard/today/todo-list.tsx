import Link from "next/link";

import type { EngagementTier } from "@/generated/prisma/enums";
import { describeNextAction, isUrgent, type NextAction } from "@/lib/closing/dashboard/next-action";
import { formatRelative } from "@/lib/format";
import { cn } from "cn";

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

/** Open deals, most urgent first, each with the next thing to do. */
export function TodoList({ rows, now }: { rows: TodoRow[]; now: Date }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card ring-1 ring-border">
      {rows.map((row) => {
        const read =
          row.action.kind === "call_now"
            ? ", en ce moment"
            : row.lastActivityAt
              ? `, lu ${formatRelative(row.lastActivityAt, now)}`
              : "";
        const urgent = isUrgent(row.action);
        const state = (
          <>
            {row.state}
            <span className="text-muted-foreground">{read}</span>
          </>
        );
        return (
          <li
            key={row.id}
            className="group relative flex items-stretch gap-4 py-3.5 pr-3 pl-4 transition-colors hover:bg-muted/50"
          >
            <HeatBar tier={row.tier} score={row.score} />
            <div className="min-w-0 flex-1 space-y-0.5">
              <div className="flex items-baseline justify-between gap-4">
                <Link
                  href={`/links/${row.id}`}
                  className="truncate font-medium outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/50 focus-visible:after:ring-inset"
                >
                  {row.company && <span className="font-normal text-muted-foreground">Société : </span>}
                  {row.label}
                </Link>
                <span className={cn("hidden shrink-0 text-sm sm:block", !row.tier && "text-muted-foreground")}>
                  {state}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {[
                  row.company && row.contact ? `Contact : ${row.contact}` : null,
                  `Document : ${row.documentName}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <p className={cn("text-sm sm:hidden", !row.tier && "text-muted-foreground")}>{state}</p>
              <p
                className={cn(
                  "flex items-center gap-2 text-sm",
                  urgent ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {row.action.kind === "call_now" && <LiveDot className="size-2" />}
                {describeNextAction(row.action, now)}
              </p>
              {row.insightHeadline && (
                <p className="truncate text-sm text-muted-foreground" title={row.insightHeadline}>
                  IA : {row.insightHeadline}
                </p>
              )}
            </div>
            <div className="relative z-10 flex items-center">
              <CopyButton value={row.url} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
