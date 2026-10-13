import { readerLine, readerWho, type PulseReader } from "../lib/pulse";

import { h } from "./dom";

/** "P.4 · 3 min": the page being read and for how long, set as an instrument reading. */
export function readingField(reader: PulseReader, now = Date.now()) {
  const minutes = Math.floor((now - new Date(reader.startedAt).getTime()) / 60_000);
  const since = Number.isFinite(minutes) ? (minutes < 1 ? "<1 min" : `${minutes} min`) : null;
  return [reader.currentPage ? `P.${reader.currentPage}` : null, since].filter(Boolean).join(" · ");
}

/** One report row per prospect reading now: live dot, who, the reading. Shared by the popup and the Outlook pane. */
export function readerRows(readers: PulseReader[], open: (reader: PulseReader) => void) {
  return h(
    "ul",
    { class: "readings" },
    ...readers.map((reader) =>
      h(
        "li",
        {},
        h(
          "button",
          { class: "reader", type: "button", "aria-label": readerLine(reader), onclick: () => open(reader) },
          h("span", { class: "dot", "aria-hidden": "true" }),
          h("span", { class: "who" }, readerWho(reader)),
          h("span", { class: "field" }, readingField(reader)),
        ),
      ),
    ),
  );
}
