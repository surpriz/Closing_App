import tokens from "./tokens.css?raw";

// The panel lives in a shadow root: the tokens are declared on :host, so the
// page's own variables never leak in and the app's palette applies as is.
// Floating over the mailbox is the one place a shadow is earned (--elevation-md).
export const STYLES = `
${tokens}
:host { all: initial; }
* { box-sizing: border-box; font-family: var(--font-sans); font-variant-numeric: tabular-nums; }
::selection { background: var(--iron-3); color: var(--selection-ink); }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
.compose { position: fixed; pointer-events: none; }
svg { display: block; flex: none; }

.fab {
  pointer-events: auto; position: absolute; right: 0; bottom: 0; width: 28px; height: 28px;
  display: grid; place-items: center; padding: 0;
  border-radius: var(--radius-md); border: 1px solid var(--overlay-border);
  background: var(--card); color: var(--foreground); cursor: pointer;
  box-shadow: var(--elevation-sm); transition: background-color 150ms ease-out, box-shadow 150ms ease-out;
}
.fab:hover { background: var(--muted); box-shadow: var(--elevation-md); }
.fab:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 30%, transparent); }
.fab:active { transform: scale(0.96); }

.panel {
  pointer-events: auto; position: absolute; right: 0; bottom: 36px; width: 320px; max-width: calc(100vw - 32px);
  background: var(--card); color: var(--foreground);
  border: 1px solid var(--overlay-border); border-radius: var(--radius-xl);
  box-shadow: var(--elevation-md); padding: 12px; font-size: 13px; line-height: 1.45;
  animation: rise 260ms var(--ease-out-soft) both;
}
.panel[hidden] { display: none; }
.panel.below { bottom: auto; top: 36px; }
.live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.head { display: flex; align-items: center; gap: 8px; margin: 0 0 4px; }
.title { font-weight: 600; margin: 0; letter-spacing: -0.005em; }
.muted { color: var(--muted-foreground); margin: 0; }
.error { margin: 0; padding: 6px 8px; border-radius: var(--radius-lg); color: var(--destructive); background: color-mix(in oklch, var(--destructive) 10%, transparent); }
.row { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }

button.primary, button.ghost {
  height: 32px; padding: 0 12px; font: 600 13px/1 var(--font-sans); border-radius: var(--radius-md); cursor: pointer;
  border: 1px solid transparent; transition: background-color 150ms ease-out;
}
button.primary { background: var(--primary); color: var(--primary-foreground); }
button.primary:hover { background: color-mix(in oklch, var(--primary) 85%, var(--card)); }
button.ghost { background: var(--card); color: var(--foreground); border-color: color-mix(in oklch, var(--foreground) 80%, transparent); }
button.ghost:hover { background: var(--muted); }
button:focus-visible { outline: none; box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 30%, transparent); }
button:active:not(:disabled) { transform: scale(0.98); }
button:disabled { opacity: 0.5; cursor: default; }

input.search {
  width: 100%; height: 32px; margin-top: 12px; padding: 0 10px; border-radius: var(--radius-lg); border: 1px solid var(--input);
  font: 13px var(--font-sans); background: var(--card); color: inherit; caret-color: var(--iron-2);
}
input.search::placeholder { color: var(--muted-foreground); }
input.search:focus-visible { outline: none; border-color: var(--ring); box-shadow: 0 0 0 3px color-mix(in oklch, var(--ring) 20%, transparent); }

/* The document list: flush rows between hairlines, not cards */
ul {
  list-style: none; margin: 8px 0 0; padding: 0; max-height: 220px; overflow: auto;
  border-top: 1px solid var(--border); scrollbar-width: thin; scrollbar-color: var(--input) transparent;
}
li { border-bottom: 1px solid var(--border); }
li > p { padding: 8px 0; }
li button {
  display: block; width: 100%; text-align: left; background: transparent; border: 0; border-radius: 0; padding: 8px 6px;
  font: 13px/1.3 var(--font-sans); color: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
li button:hover { background: color-mix(in oklch, var(--muted) 60%, transparent); }
li button:focus-visible { box-shadow: inset 0 0 0 2px var(--ring); }

/* Progress is not heat: ink on a hairline track, square ends */
.bar { height: 3px; background: var(--border); margin-top: 10px; overflow: hidden; }
.bar > span { display: block; height: 100%; background: var(--foreground); transition: width 150ms ease-out; }

.banners { position: fixed; top: 72px; right: 16px; display: grid; gap: 8px; width: 340px; max-width: calc(100vw - 32px); pointer-events: none; }
.banner {
  pointer-events: auto; display: grid; grid-template-columns: auto 1fr auto; gap: 2px 10px; align-items: start;
  background: var(--card); color: var(--foreground);
  border: 1px solid var(--overlay-border); border-radius: var(--radius-xl);
  box-shadow: var(--elevation-md); padding: 12px; font-size: 13px; line-height: 1.45;
  animation: rise 260ms var(--ease-out-soft) both;
}
.banner .mark { color: var(--foreground); margin-top: 1px; }
.banner .text { min-width: 0; display: grid; gap: 2px; }
.banner .title { display: flex; align-items: center; gap: 6px; }
/* Someone reads now: the live dot, the one circle besides the logo's hot spot */
.banner .dot { flex: none; width: 8px; height: 8px; border-radius: 50%; background: var(--heat-hot); animation: blink 1.6s ease-in-out infinite; }
/* The prospect acted: a signed swatch, square */
.banner.action .dot { border-radius: 0; background: var(--success); animation: none; }
.banner .close {
  display: grid; place-items: center; width: 24px; height: 24px; margin: -4px -4px 0 0; padding: 0;
  background: transparent; border: 0; border-radius: var(--radius-md); color: var(--muted-foreground); cursor: pointer;
}
.banner .close:hover { background: var(--muted); color: var(--foreground); }
.banner .row { grid-column: 2 / 4; margin-top: 8px; }
@keyframes rise { from { opacity: 0; transform: translateY(4px); } }
@keyframes blink { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) {
  .panel, .banner, .banner .dot { animation: none; }
  .fab, button { transition: none; }
}
`;
