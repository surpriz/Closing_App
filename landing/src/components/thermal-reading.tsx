"use client";

import { useEffect, useState } from "react";

import { HeatScale, ThermalPlate } from "./thermal-plate";

// Example reading, labelled as such on the page.
const PAGES = [
  { title: "Couverture", time: "0:14", heat: 0.3 },
  { title: "Contexte", time: "0:41", heat: 0.5 },
  { title: "Méthode", time: "1:12", heat: 0.68 },
  { title: "Tarifs", time: "3:38", heat: 1 },
  { title: "Planning", time: "0:22", heat: 0.38 },
  { title: "Conditions", time: "—", heat: 0 },
];
const HOTTEST = 3;
const STEP_MS = 520;

/** The hero's signature: the example quote heats up page by page, then the reticle lands on Tarifs. */
export function ThermalReading() {
  const [read, setRead] = useState(-1);

  useEffect(() => {
    // Reduced motion: land on the final reading at once.
    const step = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : STEP_MS;
    const start = step ? 500 : 0;
    const timers = PAGES.map((_, i) => window.setTimeout(() => setRead(i), start + i * step));
    timers.push(window.setTimeout(() => setRead(PAGES.length), start + PAGES.length * step + (step ? 300 : 0)));
    return () => timers.forEach(window.clearTimeout);
  }, []);

  const done = read >= PAGES.length;

  return (
    <figure className="border-y border-ink">
      <figcaption className="sr-only">
        Exemple : Marie Dupont, Atelier Morel, a lu le devis. Elle a passé 3 min 38 sur la page Tarifs, la plus lue.
        Clozer la juge chaude.
      </figcaption>
      <div className="mx-auto grid max-w-[90rem] grid-cols-3 gap-px bg-ink sm:grid-cols-6 lg:grid-cols-[repeat(6,minmax(0,1fr))_3.5rem]">
        {PAGES.map((page, i) => (
          <div key={page.title} className="relative bg-paper">
            <ThermalPlate heat={read >= i ? page.heat : 0} seed={i} className="aspect-[3/4] w-full">
              {i === HOTTEST && (
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
                  {i === HOTTEST && done ? "Sp1 " : ""}P.{i + 1}
                  <span className="max-sm:hidden"> {page.title}</span>
                </span>
                <span>{page.time}</span>
              </span>
            </ThermalPlate>
          </div>
        ))}
        <div className="hidden flex-col items-center gap-2 bg-paper py-3 font-mono text-micro text-ink-soft lg:flex">
          <span>Chaud</span>
          <HeatScale className="w-3 flex-1" />
          <span>Froid</span>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-ink px-5 py-2 font-mono text-micro text-ink-soft lg:hidden">
        <span>Froid</span>
        <HeatScale orientation="horizontal" className="flex-1" />
        <span>Chaud</span>
      </div>
    </figure>
  );
}
