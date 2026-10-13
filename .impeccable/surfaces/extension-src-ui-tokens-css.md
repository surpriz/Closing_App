---
version: 1
slug: "extension-src-ui-tokens-css"
primary_target: "extension/src/ui/tokens.css"
related_targets: ["outlook/src/taskpane.html"]
---

# Chrome extension (Gmail / Outlook web) and Outlook add-in

Mode: Operate. User: the seller inside their mailbox. Job: swap a PDF attachment for a Clozer link in two clicks, see who is reading, get notified. Constraints: lives inside Gmail/Outlook chrome (must not fight their UI), small panels and popups, pairing by code.

## Direction contract
THESIS: A measuring instrument clipped onto the mailbox: a compact report card, graphite on paper, with heat only where a reading exists. Refuses the floating colourful widget.
OWN-WORLD: Same tokens as the app (DESIGN.md): paper/sheet/ink/hairlines, near-square corners, Archivo + Geist Mono for readings, ironbow only on heat data, hatch only for overdue.
STORY: I attach a quote → Clozer offers the link → I send → the badge tells me when it is read.
FIRST VIEWPORT: Popup/taskpane = report header strip (logo, workspace) then the live list of recent readings as report rows with HeatStrip-like mini plates where page data exists, one primary ink action.
FORM: Rapport de thermographie (inherited world), seed: none (unavailable)
Signature interaction: badge/notification shows the hottest page reading ("p.4 · 2 min 40").
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
