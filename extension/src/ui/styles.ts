import tokens from "./tokens.css?raw";

// The panel lives in a shadow root: the tokens are declared on :host, so the
// page's own variables never leak in and the app's palette applies as is.
export const STYLES = `
${tokens}
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
.compose { position: fixed; pointer-events: none; }
.fab {
  pointer-events: auto; position: absolute; right: 0; bottom: 0; width: 28px; height: 28px;
  border-radius: var(--radius); border: 0; background: var(--foreground);
  color: var(--background); font: 700 14px/1 ui-sans-serif, system-ui; cursor: pointer;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); opacity: 0.75; transition: opacity 120ms;
}
.fab:hover, .fab:focus-visible { opacity: 1; outline: none; box-shadow: 0 0 0 3px color-mix(in oklch, var(--brand) 35%, transparent); }
.panel {
  pointer-events: auto; position: absolute; right: 0; bottom: 36px; width: 320px; max-width: calc(100vw - 32px);
  background: var(--card); color: var(--foreground); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.14); padding: 12px; font-size: 13px; line-height: 1.4;
}
.panel[hidden] { display: none; }
.panel.below { bottom: auto; top: 36px; }
.live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.title { font-weight: 600; margin: 0 0 4px; }
.muted { color: var(--muted-foreground); margin: 0; }
.error { color: var(--destructive); margin: 0; }
.row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
button.primary, button.ghost {
  font: 500 13px/1 inherit; border-radius: var(--radius); padding: 8px 12px; cursor: pointer; border: 1px solid transparent;
}
button.primary { background: var(--foreground); color: var(--background); }
button.ghost { background: transparent; color: inherit; border-color: var(--border); }
button:focus-visible { outline: 2px solid var(--brand); outline-offset: 2px; }
button:disabled { opacity: 0.6; cursor: default; }
input.search {
  width: 100%; margin-top: 8px; padding: 7px 9px; border-radius: var(--radius); border: 1px solid var(--border);
  font: inherit; background: transparent; color: inherit;
}
input.search:focus-visible { outline: 2px solid var(--brand); outline-offset: 1px; }
ul { list-style: none; margin: 8px 0 0; padding: 0; max-height: 220px; overflow: auto; }
li button {
  width: 100%; text-align: left; background: transparent; border: 0; border-radius: var(--radius); padding: 7px 8px;
  font: inherit; color: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
li button:hover, li button:focus-visible { background: var(--muted); outline: none; }
.bar { height: 4px; border-radius: 999px; background: var(--muted); margin-top: 10px; overflow: hidden; }
.bar > span { display: block; height: 100%; background: var(--brand); transition: width 150ms; }
.banners { position: fixed; top: 72px; right: 16px; display: grid; gap: 8px; width: 340px; max-width: calc(100vw - 32px); pointer-events: none; }
.banner {
  pointer-events: auto; display: grid; grid-template-columns: auto 1fr auto; gap: 4px 10px; align-items: start;
  background: var(--card); color: var(--foreground); border: 1px solid var(--border);
  border-radius: 12px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.14); padding: 12px; font-size: 13px; line-height: 1.4;
  animation: in 180ms ease-out;
}
.banner .dot { width: 8px; height: 8px; margin-top: 5px; border-radius: 50%; background: var(--heat-hot); animation: blink 1.6s ease-in-out infinite; }
.banner.action .dot { background: var(--success); animation: none; }
.banner .text { min-width: 0; }
.banner .close { background: transparent; border: 0; color: inherit; opacity: 0.55; cursor: pointer; font-size: 16px; line-height: 1; padding: 0 2px; }
.banner .close:hover, .banner .close:focus-visible { opacity: 1; outline: none; }
.banner .row { grid-column: 2 / 4; margin-top: 4px; }
@keyframes in { from { opacity: 0; transform: translateY(-6px); } }
@keyframes blink { 50% { opacity: 0.35; } }
@media (prefers-reduced-motion: reduce) { .banner, .banner .dot { animation: none; } }
`;
