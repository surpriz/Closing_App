/** Opens the help assistant from anywhere in the dashboard (user menu, ⌘K) without sharing state. */
export const OPEN_HELP_EVENT = "clozer:open-help";

export function openHelp() {
  window.dispatchEvent(new Event(OPEN_HELP_EVENT));
}
