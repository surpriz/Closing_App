import type { ViewSignalType } from "@/generated/prisma/enums";

/** Reports what the reader did around the content. Fire and forget: survives the tab closing. */
export function sendSignal(viewId: string | null, type: ViewSignalType, valueMs?: number, detail?: string) {
  if (!viewId) return;
  const body = JSON.stringify({
    viewId,
    type,
    ...(valueMs !== undefined && { valueMs: Math.round(valueMs) }),
    ...(detail !== undefined && { detail }),
  });
  if (navigator.sendBeacon?.("/api/track/signal", new Blob([body], { type: "application/json" }))) return;
  fetch("/api/track/signal", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  }).catch(() => {});
}
