"use client";

import { useEffect, useState } from "react";

import { HeatScale, ThermalPlate } from "./thermal-plate";
import type { ReadingDocument } from "./thermal-reading-data";

const STEP_MS = 520;

/**
 * The hero's signature: an example document heats up page by page, then the reticle lands on
 * the most-read page. The tabs replay it on another kind of document.
 */
export function ThermalReading({
  documents,
  labels,
}: {
  documents: ReadingDocument[];
  labels: { tablist: string; hot: string; cold: string };
}) {
  const [docIndex, setDocIndex] = useState(0);
  const [read, setRead] = useState(-1);
  const doc = documents[docIndex];
  const pages = doc.pages;

  useEffect(() => {
    // Reduced motion: land on the final reading at once.
    const step = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : STEP_MS;
    const start = step ? 300 : 0;
    const timers = [window.setTimeout(() => setRead(-1), 0)];
    pages.forEach((_, i) => timers.push(window.setTimeout(() => setRead(i), start + i * step)));
    timers.push(window.setTimeout(() => setRead(pages.length), start + pages.length * step + (step ? 300 : 0)));
    return () => timers.forEach(window.clearTimeout);
  }, [pages]);

  const done = read >= pages.length;
  const video = doc.video;

  return (
    <figure className="border-y border-ink">
      <figcaption className="sr-only">{doc.caption}</figcaption>
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-stretch justify-between gap-x-6 border-b border-ink px-5 sm:px-8">
        <div role="tablist" aria-label={labels.tablist} className="-ml-px flex flex-wrap">
          {documents.map((item, i) => (
            <button
              key={item.tab}
              type="button"
              role="tab"
              aria-selected={i === docIndex}
              onClick={() => setDocIndex(i)}
              className={`relative border-r border-rule px-4 py-3 text-small transition-colors first:border-l ${
                i === docIndex
                  ? "bg-sheet font-semibold text-ink after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-ink"
                  : "text-ink-soft hover:bg-sheet hover:text-ink"
              }`}
            >
              {item.tab}
            </button>
          ))}
        </div>
        <p className="flex items-center py-3 text-small text-ink-soft">
          <span className="font-mono">{doc.name}</span>
        </p>
      </div>
      <div className="mx-auto grid max-w-[90rem] grid-cols-3 gap-px bg-ink sm:grid-cols-6 lg:grid-cols-[repeat(6,minmax(0,1fr))_3.5rem]">
        {pages.map((page, i) => (
          <div key={`${docIndex}-${page.title}`} className="relative bg-paper">
            <ThermalPlate heat={read >= i ? page.heat : 0} seed={i} frame={video} className="aspect-[3/4] w-full">
              {i === doc.hottest && (
                <span
                  aria-hidden
                  className="reticle absolute top-[44%] left-1/2 size-12 -translate-x-1/2 -translate-y-1/2 border-2 border-sheet"
                  style={{ opacity: done ? 1 : 0 }}
                >
                  <span className="absolute -top-3 -bottom-3 left-1/2 w-0.5 -translate-x-1/2 bg-sheet" />
                  <span className="absolute top-1/2 -right-3 -left-3 h-0.5 -translate-y-1/2 bg-sheet" />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 flex items-baseline justify-between gap-2 px-2.5 py-2 font-mono text-micro text-sheet">
                <span className="truncate">
                  {i === doc.hottest && done ? "Sp1 " : ""}
                  {page.at ?? `P.${i + 1}`}
                  <span className="max-sm:hidden"> {page.title}</span>
                </span>
                <span>{page.time}</span>
              </span>
            </ThermalPlate>
          </div>
        ))}
        <div className="hidden flex-col items-center gap-2 bg-paper py-3 font-mono text-micro text-ink-soft lg:flex">
          <span>{labels.hot}</span>
          <HeatScale className="w-3 flex-1" />
          <span>{labels.cold}</span>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-ink px-5 py-2 font-mono text-micro text-ink-soft lg:hidden">
        <span>{labels.cold}</span>
        <HeatScale orientation="horizontal" className="flex-1" />
        <span>{labels.hot}</span>
      </div>
    </figure>
  );
}
