"use client";

import { useEffect, useState } from "react";

import { HeatScale, ThermalPlate } from "./thermal-plate";
import { HOTTEST_PAGE, type ReadingPage } from "./thermal-reading-data";

const STEP_MS = 520;

/**
 * The hero's signature: the sample proposal heats up page by page, then the reticle lands on
 * the most-read page. Rendered cold on the server, so the page reads fine without JS.
 */
export function ThermalReading({
  name,
  caption,
  summary,
  pages,
  labels,
}: {
  name: string;
  /** Screen-reader summary of the reading. */
  caption: string;
  summary: string;
  pages: ReadingPage[];
  labels: { example: string; hot: string; cold: string };
}) {
  const [read, setRead] = useState(-1);

  useEffect(() => {
    const step = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : STEP_MS;
    const start = step ? 300 : 0;
    const timers = pages.map((_, i) => window.setTimeout(() => setRead(i), start + i * step));
    timers.push(window.setTimeout(() => setRead(pages.length), start + pages.length * step + (step ? 300 : 0)));
    return () => timers.forEach(window.clearTimeout);
  }, [pages]);

  const done = read >= pages.length;

  return (
    <figure className="border border-ink bg-sheet">
      <figcaption className="sr-only">{caption}</figcaption>
      <div aria-hidden>
        <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-ink px-4 py-2.5 text-small">
          <span className="font-mono text-micro">{name}</span>
          <span className="shrink-0 text-micro text-ink-soft">{labels.example}</span>
        </p>
        <div className="grid grid-cols-4 gap-px border-b border-ink bg-ink">
          {pages.map((page, i) => (
            <div key={page.label} className="bg-sheet">
              <ThermalPlate heat={read >= i ? page.heat : 0} seed={i} heading={page.heading} className="aspect-[3/4] w-full">
                {i === HOTTEST_PAGE && (
                  <span
                    className="reticle absolute top-[44%] left-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 border-2 border-sheet"
                    style={{ opacity: done ? 1 : 0 }}
                  >
                    <span className="absolute -top-2 -bottom-2 left-1/2 w-0.5 -translate-x-1/2 bg-sheet" />
                    <span className="absolute top-1/2 -right-2 -left-2 h-0.5 -translate-y-1/2 bg-sheet" />
                  </span>
                )}
              </ThermalPlate>
              <p className="grid gap-0.5 px-2 py-2 text-micro sm:px-3">
                <span className={`truncate ${i === HOTTEST_PAGE ? "font-semibold text-ink" : "text-ink-soft"}`}>{page.label}</span>
                <span className={`font-mono ${i === HOTTEST_PAGE ? "text-ink" : "text-ink-soft"}`}>{page.time}</span>
              </p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
          <p className="text-small font-medium">{summary}</p>
          <p className="flex min-w-40 flex-1 items-center gap-3 font-mono text-micro text-ink-soft sm:max-w-56">
            <span>{labels.cold}</span>
            <HeatScale orientation="horizontal" className="flex-1" />
            <span>{labels.hot}</span>
          </p>
        </div>
      </div>
    </figure>
  );
}
