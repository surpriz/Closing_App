---
name: Clozer
description: "Rapport de thermographie: a proposal read through a thermal camera, on cool report paper with graphite ink."
colors:
  graphite-ink: "oklch(0.215 0.008 265)"
  report-paper: "oklch(0.972 0.003 260)"
  sheet-white: "oklch(1 0 0)"
  paper-tint: "oklch(0.945 0.004 260)"
  soft-ink: "oklch(0.46 0.01 265)"
  hairline: "oklch(0.885 0.005 265)"
  field-stroke: "oklch(0.8 0.006 265)"
  iron-0: "oklch(0.2 0.09 293)"
  iron-1: "oklch(0.42 0.17 322)"
  iron-2: "oklch(0.62 0.2 33)"
  iron-3: "oklch(0.85 0.16 82)"
  iron-4: "oklch(0.97 0.04 95)"
  heat-cold: "oklch(0.36 0.12 293)"
  signed-green: "oklch(0.5 0.12 155)"
  caution-amber: "oklch(0.58 0.13 70)"
  error-red: "oklch(0.53 0.2 25)"
  night-background: "oklch(0.165 0.006 265)"
  night-sheet: "oklch(0.2 0.007 265)"
  night-raised: "oklch(0.23 0.008 265)"
  night-tint: "oklch(0.25 0.008 265)"
  night-ink: "oklch(0.95 0.003 260)"
  night-soft-ink: "oklch(0.72 0.008 265)"
  night-hairline: "oklch(0.3 0.008 265)"
  night-field-stroke: "oklch(0.38 0.008 265)"
  night-iron-1: "oklch(0.48 0.18 322)"
  night-iron-2: "oklch(0.68 0.19 35)"
  night-iron-3: "oklch(0.86 0.15 82)"
  night-heat-cold: "oklch(0.6 0.14 300)"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 1.6rem + 2.4vw, 3.5rem)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 72"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2rem"
    fontWeight: 750
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 72"
  heading:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 650
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "'tnum' 1"
  small:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum' 1"
  micro:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: 1.3
  report-field:
    fontFamily: "Geist Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.3
  landing-display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(3rem, 1.6rem + 5.2vw, 6rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.035em"
    fontVariation: "'wdth' 72"
  landing-title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2rem, 1.4rem + 2.2vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.03em"
    fontVariation: "'wdth' 72"
  landing-lead:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 400
    lineHeight: 1.5
  landing-body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  none: "0px"
  sm: "2.4px"
  md: "3.2px"
  lg: "4px"
  xl: "6px"
spacing:
  hairline-gap: "1px"
  row-y: "16px"
  card: "20px"
  card-sm: "12px"
  gutter-phone: "16px"
  gutter: "24px"
  header: "56px"
  landing-gutter-phone: "20px"
  landing-gutter: "32px"
  landing-section: "80px"
  landing-section-md: "112px"
components:
  button-primary:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.sheet-white}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-outline:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.paper-tint}"
  button-ghost-hover:
    backgroundColor: "{colors.paper-tint}"
    textColor: "{colors.graphite-ink}"
  input:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.lg}"
    padding: "4px 12px"
    height: "36px"
  card:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.xl}"
    padding: "{spacing.card}"
  badge-neutral:
    backgroundColor: "{colors.paper-tint}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
    height: "20px"
  nav-tab-active:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.graphite-ink}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "56px"
  nav-tab:
    textColor: "{colors.soft-ink}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "56px"
  signup-submit:
    backgroundColor: "{colors.graphite-ink}"
    textColor: "{colors.sheet-white}"
    typography: "{typography.landing-lead}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "64px"
  signup-field:
    backgroundColor: "{colors.sheet-white}"
    textColor: "{colors.graphite-ink}"
    typography: "{typography.landing-lead}"
    rounded: "{rounded.none}"
    padding: "0 16px"
    height: "56px"
---

# Design System: Clozer

## Overview

**Creative North Star: "Rapport de thermographie"**

Every Clozer surface is a building-thermography report about a proposal. The page is cool white report paper (graphite night in the app's dark theme), written in graphite ink, divided by hairline rules into numbered fields. The document being tracked appears as a strip of thermal plates: each page of the quote seen through a camera, heating from deep indigo to white-hot where the prospect lingered. A calibrated scale bar sits beside the readings, a reticle marks the hottest page. Everything that is not heat data stays achromatic, so the one colour on screen is always a measurement.

The world has two registers built from one material. The landing (Persuade) is the full report: square corners, ink rules between sections, a huge condensed headline, a live reading of an example quote that heats over a few seconds. The seller app (Operate) is the same report folded into a working tool: the "Rapport du jour" header strip, a ranked list of deals as report rows each led by its thermal strip, near-square controls (2.4 to 6px) where the app needs affordances. Density is moderate; rows breathe (16px vertical) but there are no decorative panels, no KPI-card grid, no gradients outside heat.

Rejected by the direction contracts and absent from the build: the grey KPI-card dashboard, the split hero with a product screenshot and a row of feature cards.

**Key Characteristics:**
- Achromatic chrome: paper, sheet white, graphite ink, hairlines.
- The ironbow scale (iron-0 to iron-4) paints heat data only: plates, scale bars, heat swatches, the logo's hot spot.
- Archivo on its width axis: condensed (72%) for verdict headlines, normal width for everything else; Geist Mono for report fields.
- Tabular digits everywhere (`font-variant-numeric: tabular-nums` on body).
- Hairline grids and ink rules instead of boxes and shadows.
- One texture, the diagonal hatch, reserved for overdue follow-ups.

## Colors

A graphite-on-paper report with exactly one chromatic scale, and that scale only ever measures reading time.

### Primary
- **Graphite Ink** (graphite-ink): text, primary buttons, ink rules that delimit major blocks (header bottom, deal list top and bottom, landing section borders), focus ring, active nav underline. It is also `primary`, `brand`, `info` and `ring` in the app: the system has no brand hue.

### Tertiary: the Ironbow scale (heat data only)
- **Cold Indigo** (iron-0): the base of every thermal plate, the cold end of the scale bar.
- **Violet Bloom** (iron-1): first warmth on a plate, the outer halo of a read zone.
- **Red-Orange Hot** (iron-2): the "Chaud" reading (`heat-hot` maps to it), the logo's hot spot, text caret colour, the landing focus outline.
- **Sodium Yellow** (iron-3): the "Tiède" reading (`heat-warm` maps to it), text selection background.
- **White-Hot** (iron-4): the core of the most-read page; hover fill of the dark-tone signup button.
- **Cold Reading** (heat-cold): the "Froid" swatch, a lifted indigo so it stays visible as a small square on paper.

In dark mode the scale lifts (night-iron-1, night-iron-2, night-iron-3, night-heat-cold) so plates and swatches keep contrast on graphite.

### Status (state only)
- **Signed Green** (signed-green): validated/signed deals (row swatch, success badge and button).
- **Caution Amber** (caution-amber): warning badges.
- **Error Red** (error-red): destructive actions and invalid fields, always as a 10 to 20% tint with red text, never a solid red slab.

### Neutral
- **Report Paper** (report-paper): page background, sticky headers.
- **Sheet White** (sheet-white): cards, list surfaces, popovers, the active nav cell, the landing's specimen band.
- **Paper Tint** (paper-tint): muted fills, row hover (at 60%), secondary buttons, neutral pills, unread plate placeholders.
- **Soft Ink** (soft-ink): secondary text, metadata, report-field labels.
- **Hairline** (hairline): dividers between rows and fields, nav cell separators.
- **Field Stroke** (field-stroke): input borders, scrollbar thumb.
- Night equivalents (night-background, night-sheet, night-raised, night-tint, night-ink, night-soft-ink, night-hairline, night-field-stroke) carry the same roles in the app's `.dark` theme. The landing ships light only.

### Named Rules
**The Ironbow-Only-On-Heat Rule.** iron-0 to iron-4 and the heat tokens appear only where they encode reading heat (plates, scale bars, heat swatches and badges, live dot) plus three fixed brand touches: the logo's hot spot, the text caret, the selection highlight. Never on buttons, headings, backgrounds or icons.

**The Achromatic Chrome Rule.** Navigation, buttons, cards and type are graphite on paper. The primary action is ink, not a hue.

**The Word-Beside-Swatch Rule.** Temperature is never colour alone: every heat swatch sits next to its word (Chaud / Tiède / Froid, or "Pas encore lu") and often its score. Heat swatches are small squares (8 to 10px).

## Typography

**Display Font:** Archivo, condensed via the width axis (`font-stretch: 72%`, the `condensed` utility), with ui-sans-serif fallback
**Body Font:** Archivo at normal width
**Label/Mono Font:** Geist Mono, for report fields and measured values

**Character:** One grotesque in two widths: condensed and heavy for the verdict ("Voyez où votre devis chauffe.", the day's headline), plain and even for reading. Mono marks anything that reads like an instrument field: report number, date, page reference, score points.

### Hierarchy
- **Display** (800, clamp 36 to 56px, 0.98, condensed): the day's headline on "Aujourd'hui", the onboarding opener.
- **Title** (750, 32px, 1.05, condensed): page h1 elsewhere; Aujourd'hui uses it on phones.
- **Heading** (650, 18px, 1.3): section h2 inside the app.
- **Body** (400, 15px, 1.55): reading text, next-action lines, descriptions.
- **Small** (400, 13px, 1.45): metadata, row state, nav tabs, secondary text.
- **Micro** (11px, 1.3): phone tab-bar labels; in mono, report fields.
- **Landing register**: landing-display (800, clamp 48 to 96px, 0.92, condensed), landing-title (700, clamp 32 to 52px, condensed), landing-lead (19px, 1.5) for intros and the signup field, landing-body (16px, 1.6). Reading measure is held to 52 to 62ch.

### Named Rules
**The Condensed Verdict Rule.** Condensed width is for headlines that state a verdict (display and title roles), the wordmark, and large measured figures (a score, a segment name on the landing). Body, labels and buttons stay at normal width.

**The Role-Scale Rule.** Pick a role (display, title, heading, body, small, micro), never a pixel size. The scale exists so a page never picks a size again.

**The Instrument Digit Rule.** All digits are tabular. Values that read as instrument output (P.4, 3:38, +34, n° 0412, dates in the report strip) are set in Geist Mono.

## Layout

The page is a report sheet ruled into fields. Major blocks are bounded by a graphite ink rule; items inside a block are separated by hairlines. Lists are flush, full-width rows with dividers rather than spaced cards.

- **App shell:** sticky 56px header with an ink bottom rule; content container max 80rem with 16px gutters (24px from `sm`), 32 to 40px top padding, extra bottom padding on phones to clear the fixed tab bar. Aujourd'hui is a two-column grid on large screens (main list + 18rem aside, 48px gap).
- **Report header strip:** a full-width mono row under a hairline: "Rapport du jour", the date, the count of open deals. On the landing, "Rapport de lecture n° 0412", the example quote, and the "Exemple de démonstration" label.
- **Deal rows:** grid of thermal strip, content, actions; 16px vertical padding, 12 to 16px horizontal; on phones the strip spans the row above the content.
- **Thermal strips:** plates sit 1px apart (`gap-px`), 3:4 aspect, 28px wide (16px when a document has more than six pages so the strip stays on one line).
- **Onboarding:** 12rem numbered margin column (mono "1/4") separated by an ink rule, the step sheet beside it; footer actions above an ink rule.
- **Landing:** max 90rem with 20px / 32px gutters, sections 80px / 112px tall in padding, asymmetric 5:7 or 6:7 column splits, the hero plates full-bleed in a 6-column grid with the vertical scale as a seventh column on large screens. On phones plates fold to 3 columns and the scale goes horizontal.
- **Mobile:** the app swaps header tabs for a fixed bottom tab bar (min 56px cells, ink top rule, safe-area padding).

**The Hairline Field Rule.** Ink rule = boundary of a block; hairline = separation inside it. Never box an item that a hairline can separate.

## Elevation & Depth

Paper-flat. Depth comes from the paper / sheet-white contrast and from rules, not shadows. The shadow scale exists for floating layers and one interactive state; elevation-xs is deliberately transparent so components that ask for it stay flat.

### Shadow Vocabulary
- **Sheet lift** (`0 1px 2px` graphite at 6%): elevation-sm, rare.
- **Floating** (`0 2px 4px` at 5% plus `0 10px 28px -8px` at 18%): elevation-md, menus, popovers, and the hover of an interactive card.
- **Overlay** (`0 4px 8px` at 6% plus `0 24px 56px -14px` at 28%): elevation-lg, dialogs and sheets.
- Dark theme uses the same geometry in black at 30 to 65%.

**The Paper-Flat Rule.** Surfaces lie flat at rest. A shadow means "this floats" (popover, dialog) or "this responds to you" (interactive card hover), nothing else.

## Shapes

Near-square. The app's base radius is 4px and everything derives from it: badges 2.4px, buttons 3.2px, inputs 4px, cards 6px. The landing is fully square (0px): fields, buttons, plates, the prospect sheet. Thermal plates, heat swatches and the nav cells are square in both apps.

Circles appear only as a hot spot: the filled dot inside the logo's reticle, and the pulsing live-reading dot. The reticle itself is a square frame with crosshair arms (landing hero) or a 1px white inset square (app strip).

**The Near-Square Rule.** No radius above 6px on new surfaces. Pills and fully-rounded controls do not belong to this world.

**The One Texture Rule.** The diagonal hatch (135deg, 1.5px stroke, 6px period, in currentColor) marks an overdue follow-up and nothing else.

## Components

### Buttons
Ink stamps: flat, near-square, semibold.
- **Shape:** 3.2px corners; heights 24 / 28 / 36 / 40 / 48px (xs, sm, default, lg, xl).
- **Primary:** graphite ink fill, white text, 12px side padding at default size; hover drops to 85% ink.
- **Outline:** sheet-white fill with an 80% ink stroke; hover tints to paper-tint.
- **Ghost / Secondary:** no fill / paper-tint fill; hover paper-tint.
- **Destructive:** red at 10% fill with red text.
- **Focus / Press:** ring-colour border plus a 3px ring at 30%; press scales to 0.98. Transitions 150ms ease-out.
- **Landing CTAs:** square, full-width field rows: ink-filled submit (64px), outlined segment actions (48px) that invert to ink on hover, the arrow sliding 4px right.

### Badges and heat tags
- **Style:** 20px tall, 2.4px corners, 12px medium text.
- **Heat variants (hot / warm / cold):** a tint of the reading (14 / 22 / 12%) with ink text and a solid 8px square swatch before the word.
- **HeatPill / HeatDot:** paper-tint pill or bare line with the square swatch, the tier word and the score in soft ink; the score's reasons open in a tooltip on hover or focus.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** sheet white on report paper.
- **Border:** a 1px ring in ink at 85%, so a card reads as a ruled specimen, not a floating tile.
- **Internal Padding:** 20px (12px for the small size); footer on a 50% paper-tint band behind a hairline.
- **Shadow Strategy:** flat; interactive cards gain the floating shadow on hover (200ms).

### Inputs / Fields
- **Style:** 36px, 4px corners, field-stroke border, sheet-white fill, faint xs shadow token (transparent by design).
- **Focus:** border turns ink plus a 3px ring at 20%. Caret is red-orange hot.
- **Error / Disabled:** red border with a 20% red ring; disabled at 50% opacity.
- **Landing signup field:** the report's "Client" block: an uppercase tracked micro label row ("Votre email pro"), a 56px borderless input in lead size, the ink submit row, and "Continuer avec Google" below a rule, all inside one ink-bordered square box.

### Navigation
- **Desktop app and landing:** report-strip tabs: cells between hairlines, 16px side padding, small text in soft ink. Hover fills sheet white with ink text. Active (app) is a sheet-white cell, semibold, with a 2px ink underline sitting on the header's ink rule.
- **Phone app:** fixed bottom bar, 3 or 4 columns, 20px icon over a micro label; the active tab gets a 2px ink bar on top and a heavier icon stroke.

### Deal row (signature)
The unit of the "Aujourd'hui" report. Thermal strip of the document's pages on the left (reticle square on the most-read page; grey placeholders when never opened), then the prospect name in semibold, the state with its square swatch, "Page N la plus lue · 3 min 38", the next action led by an arrow (or the live dot when someone reads now; semibold when urgent), an optional AI line in soft ink. Copy-link on the right; the first row alone carries a "Traiter" primary button. The list is sheet white between two ink rules with hairline dividers; rows tint paper on hover and rise in with a 40ms stagger.

### Thermal plate and heat scale (signature)
A plate is a page of the document seen through the camera: iron-0 ground with four radial layers (iron-1 to iron-4) that fade in as the page's relative heat crosses 2%, 35%, 70% and 90%; the hot zone's position varies per page so plates never look stamped. An optional skeleton of white text lines at 25% screen blend suggests the page. Layers fade over 1.4s (ease-out-soft). The heat scale is the calibrated legend: a 10 to 12px bar running iron-0 → iron-4, vertical beside the hero plates, horizontal under the hero's "chauffe." and on phones. On the landing the hero plates heat page by page (520ms steps), then the reticle (square frame with crosshair) lands on "P.4 Tarifs"; reduced motion shows the end state at once.

### Logo
A measuring reticle: four square-capped corner brackets in currentColor around a red-orange hot dot, beside the lowercase wordmark "clozer" in bold condensed Archivo (22px, -0.03em).

### Coverage
Every surface is on this system: landing, login, onboarding, Aujourd'hui, documents list and document page, deal page (per-page thermal band), team, settings, help, admin, the prospect viewer (`/v/[slug]`, which never shows heat), the Chrome extension and the Outlook add-in. The vertical HeatBar is gone: heat on a row is a HeatStrip (real per-page readings) or a HeatGauge (score only). The prospect viewer and the selection/caret are achromatic. In the extension and Outlook, reader rows show the current page and time in words ("P.4 · 3 min") because those surfaces receive no per-page heat.

### Motion
One easing, ease-out-soft `cubic-bezier(0.16, 1, 0.3, 1)` (named ease-out-expo on the landing). Rise (4px, 260ms) with 40ms stagger for lists, pop (420ms) for confirmations. Everything collapses to 0.01ms under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** keep chrome achromatic: graphite ink on report paper and sheet white, with soft ink for secondary text.
- **Do** show heat as a thermal plate strip, a heat scale, or a square swatch beside its word and score.
- **Do** separate items with hairlines and bound blocks with a single ink rule.
- **Do** set verdict headlines in condensed Archivo (display or title role) and instrument values in Geist Mono with tabular digits.
- **Do** open a report screen with a mono report header strip that carries real fields (date, count, reference); a lone label is not a strip.
- **Do** label any demonstration data "Exemple de démonstration".
- **Do** keep radii at or under 6px in the app and at 0 on the landing.
- **Do** give every animation a reduced-motion end state.

### Don't:
- **Don't** put iron-0 to iron-4 or heat colours on buttons, headings, icons, backgrounds or illustrations.
- **Don't** build the grey KPI-card dashboard or a hero split with a product screenshot and a row of feature cards.
- **Don't** use the hatch for anything but an overdue follow-up.
- **Don't** convey temperature by colour alone.
- **Don't** use pills or fully rounded shapes; circles are reserved for the hot spot (logo dot, live-reading dot).
- **Don't** lift resting surfaces with shadows; shadows mean floating or responding.
- **Don't** place a small label above a section heading as a kicker; report metadata lives in the full-width header strip only.
