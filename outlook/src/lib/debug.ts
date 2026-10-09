import { APP_ORIGIN } from "./config";

// Dev build only: posts to the local app, which writes $TMPDIR/clozer-outlook.log
export function debug(...parts: unknown[]) {
  if (import.meta.env.MODE !== "development") return;
  const text = parts
    .map((part) => (part instanceof Error ? `${part.name}: ${part.message}` : typeof part === "string" ? part : JSON.stringify(part)))
    .join(" ");
  try {
    void fetch(`${APP_ORIGIN}/api/ext/log`, { method: "POST", body: text, keepalive: true }).catch(() => undefined);
  } catch {
    // nothing to do
  }
}
