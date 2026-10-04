// Scoped to the shadow root. Follows the app's ink and warmth palette.
export const STYLES = `
:host { all: initial; }
* { box-sizing: border-box; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.layer { position: fixed; inset: 0; pointer-events: none; z-index: 2147483000; }
.compose { position: fixed; pointer-events: none; }
.fab {
  pointer-events: auto; position: absolute; right: 0; bottom: 0; width: 28px; height: 28px;
  border-radius: 8px; border: 0; background: #0f1e33;
  color: #fff; font: 700 14px/1 ui-sans-serif, system-ui; cursor: pointer;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.12); opacity: 0.75; transition: opacity 120ms;
}
.fab:hover, .fab:focus-visible { opacity: 1; outline: none; box-shadow: 0 0 0 3px oklch(0.7 0.12 50 / 0.35); }
.panel {
  pointer-events: auto; position: absolute; right: 0; bottom: 36px; width: 320px; max-width: calc(100vw - 32px);
  background: oklch(0.99 0.004 80); color: oklch(0.2 0.01 60); border: 1px solid oklch(0.9 0.01 60);
  border-radius: 12px; box-shadow: 0 8px 24px rgb(0 0 0 / 0.14); padding: 12px; font-size: 13px; line-height: 1.4;
}
.panel[hidden] { display: none; }
.panel.below { bottom: auto; top: 36px; }
.live { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
.title { font-weight: 600; margin: 0 0 4px; }
.muted { color: oklch(0.5 0.01 60); margin: 0; }
.error { color: oklch(0.55 0.18 28); margin: 0; }
.row { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }
button.primary, button.ghost {
  font: 500 13px/1 inherit; border-radius: 8px; padding: 8px 12px; cursor: pointer; border: 1px solid transparent;
}
button.primary { background: oklch(0.2 0.01 60); color: oklch(0.99 0.004 80); }
button.ghost { background: transparent; color: inherit; border-color: oklch(0.88 0.01 60); }
button:disabled { opacity: 0.6; cursor: default; }
input.search {
  width: 100%; margin-top: 8px; padding: 7px 9px; border-radius: 8px; border: 1px solid oklch(0.88 0.01 60);
  font: inherit; background: transparent; color: inherit;
}
ul { list-style: none; margin: 8px 0 0; padding: 0; max-height: 220px; overflow: auto; }
li button {
  width: 100%; text-align: left; background: transparent; border: 0; border-radius: 8px; padding: 7px 8px;
  font: inherit; color: inherit; cursor: pointer; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
li button:hover, li button:focus-visible { background: oklch(0.95 0.008 70); outline: none; }
.bar { height: 4px; border-radius: 999px; background: oklch(0.93 0.008 70); margin-top: 10px; overflow: hidden; }
.bar > span { display: block; height: 100%; background: oklch(0.65 0.15 45); transition: width 150ms; }
@media (prefers-color-scheme: dark) {
  .panel { background: oklch(0.22 0.01 60); color: oklch(0.95 0.004 80); border-color: oklch(0.32 0.01 60); }
  button.primary { background: oklch(0.95 0.004 80); color: oklch(0.2 0.01 60); }
  button.ghost, input.search { border-color: oklch(0.35 0.01 60); }
  li button:hover, li button:focus-visible { background: oklch(0.28 0.01 60); }
  .muted { color: oklch(0.7 0.01 60); }
}
`;
