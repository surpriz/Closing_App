"use client";

import { useEffect, useState } from "react";

import { HeatScale, ThermalPlate } from "./thermal-plate";

// Example readings, labelled as such on the page. One per kind of document, same six-page frame.
const DOCUMENTS = [
  {
    tab: "Devis",
    name: "Devis « Refonte du site »",
    hottest: 3,
    pages: [
      { title: "Couverture", time: "0:14", heat: 0.3 },
      { title: "Contexte", time: "0:41", heat: 0.5 },
      { title: "Méthode", time: "1:12", heat: 0.68 },
      { title: "Tarifs", time: "3:38", heat: 1 },
      { title: "Planning", time: "0:22", heat: 0.38 },
      { title: "Conditions", time: "—", heat: 0 },
    ],
  },
  {
    tab: "Présentation",
    name: "Présentation « Offre 2027 »",
    hottest: 2,
    pages: [
      { title: "Couverture", time: "0:09", heat: 0.2 },
      { title: "Le constat", time: "0:52", heat: 0.5 },
      { title: "Démo", time: "2:47", heat: 1 },
      { title: "Résultats", time: "1:30", heat: 0.74 },
      { title: "Équipe", time: "0:18", heat: 0.32 },
      { title: "Contact", time: "—", heat: 0 },
    ],
  },
  {
    tab: "Doc technique",
    name: "Dossier technique « Migration ERP »",
    hottest: 2,
    pages: [
      { title: "Sommaire", time: "0:11", heat: 0.25 },
      { title: "Existant", time: "0:34", heat: 0.45 },
      { title: "Architecture", time: "4:05", heat: 1 },
      { title: "Sécurité", time: "2:10", heat: 0.8 },
      { title: "Planning", time: "0:40", heat: 0.5 },
      { title: "Annexes", time: "0:05", heat: 0.1 },
    ],
  },
  {
    tab: "Facture",
    name: "Facture n° 2026-118",
    hottest: 3,
    pages: [
      { title: "Récapitulatif", time: "0:48", heat: 0.62 },
      { title: "Détail", time: "1:05", heat: 0.78 },
      { title: "Remises", time: "0:20", heat: 0.35 },
      { title: "Échéancier", time: "1:41", heat: 1 },
      { title: "Mentions", time: "0:06", heat: 0.12 },
      { title: "RIB", time: "0:15", heat: 0.3 },
    ],
  },
];
const STEP_MS = 520;

/**
 * The hero's signature: an example document heats up page by page, then the reticle lands on
 * the most-read page. The tabs replay it on another kind of document.
 */
export function ThermalReading() {
  const [docIndex, setDocIndex] = useState(0);
  const [read, setRead] = useState(-1);
  const doc = DOCUMENTS[docIndex];
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
  const hot = pages[doc.hottest];

  return (
    <figure className="border-y border-ink">
      <figcaption className="sr-only">
        Exemple : lecture de « {doc.name} ». La page la plus lue est « {hot.title} », {hot.time}.
      </figcaption>
      <div className="mx-auto flex max-w-[90rem] flex-wrap items-stretch justify-between gap-x-6 border-b border-ink px-5 sm:px-8">
        <div role="tablist" aria-label="Type de document" className="-ml-px flex flex-wrap">
          {DOCUMENTS.map((item, i) => (
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
            <ThermalPlate heat={read >= i ? page.heat : 0} seed={i} className="aspect-[3/4] w-full">
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
                  {i === doc.hottest && done ? "Sp1 " : ""}P.{i + 1}
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
