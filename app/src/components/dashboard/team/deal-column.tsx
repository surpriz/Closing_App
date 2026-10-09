import { Sparkles } from "lucide-react";
import Link from "next/link";

import type { TeamDealRow } from "@/lib/closing/dashboard/team-queries";
import { formatRelative } from "@/lib/format";

import { HeatBar } from "../heat";
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
  return (
    <section className="min-w-0">
      <SectionTitle hint={hint}>
        {title} <span className="font-normal text-muted-foreground tabular-nums">{rows.length}</span>
      </SectionTitle>
      {rows.length === 0 ? (
        <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl bg-card shadow-xs ring-1 ring-border">
          {rows.slice(0, limit).map((row) => {
            const meta = [
              names && (names.get(row.sellerId) ?? "Ancien membre"),
              row.amountCents !== null && formatMoney({ [row.currency ?? "EUR"]: row.amountCents }),
              row.lastActivityAt ? `lu ${formatRelative(row.lastActivityAt, now)}` : "jamais ouvert",
            ].filter(Boolean);
            return (
              <li
                key={row.id}
                className="relative flex items-stretch gap-3 py-3 pr-3 pl-3.5 transition-colors duration-150 hover:bg-muted/40"
              >
                <HeatBar tier={row.tier} score={row.score} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Link
                    href={`/links/${row.id}`}
                    className="block truncate font-semibold outline-none after:absolute after:inset-0 focus-visible:after:ring-3 focus-visible:after:ring-ring/30 focus-visible:after:ring-inset"
                  >
                    {row.label}
                  </Link>
                  <p className="truncate text-small text-muted-foreground">{meta.join(" · ")}</p>
                  <ul className="flex flex-wrap gap-1">
                    {row.signals.map((signal) => (
                      <li key={signal.code} className="rounded-md bg-muted px-1.5 py-0.5 text-micro">
                        {describeHealthSignal(signal)}
                      </li>
                    ))}
                  </ul>
                  {row.insightHeadline && (
                    <p className="flex items-start gap-1.5 text-small text-muted-foreground" title={row.insightHeadline}>
                      <Sparkles className="mt-0.5 size-3.5 shrink-0 text-brand" aria-label="Analyse IA" />
                      <span className="line-clamp-2">{row.insightHeadline}</span>
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {rows.length > limit && (
        <p className="mt-2 text-sm text-muted-foreground">Et {rows.length - limit} autres.</p>
      )}
    </section>
  );
}
