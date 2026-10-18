"use client";

import { useState, type ReactNode } from "react";

/**
 * Monthly / yearly switch for the pricing page. Both prices are in the server HTML (for search engines and
 * without JS); this only sets data-interval, and the children hide the other one with
 * group-data-[interval=…]/billing variants.
 */
export function BillingToggle({
  labels,
  children,
}: {
  labels: { label: string; month: string; year: string };
  children: ReactNode;
}) {
  const [interval, setSelected] = useState<"month" | "year">("month");

  return (
    <div data-interval={interval} className="group/billing">
      <div role="group" aria-label={labels.label} className="inline-flex border border-ink">
        {(["month", "year"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={interval === value}
            onClick={() => setSelected(value)}
            className="h-11 px-5 text-small font-semibold text-ink-soft transition-colors hover:text-ink aria-pressed:bg-ink aria-pressed:text-sheet"
          >
            {labels[value]}
          </button>
        ))}
      </div>
      {children}
    </div>
  );
}
