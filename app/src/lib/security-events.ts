import { captureMessage } from "@sentry/nextjs";

export type SecurityEvent =
  | "rate_limit_crossed"
  | "magic_link_flood"
  | "webhook_blocked"
  | "upload_not_pdf";

/**
 * Something worth a look, sent to Sentry as a warning tagged kind=security: one alert rule on
 * that tag mails the platform admin. Grouped per event and scope, so a burst is one issue, not a
 * thousand. Never an email or a raw IP in the details. No-op without a Sentry DSN.
 */
export function reportSecurityEvent(event: SecurityEvent, details: Record<string, string | number | null> = {}) {
  const scope = typeof details.scope === "string" ? details.scope : event;
  console.warn(`[security] ${event}`, details);
  captureMessage(`security: ${event} (${scope})`, {
    level: "warning",
    tags: { kind: "security", event, scope },
    extra: details,
    fingerprint: ["security", event, scope],
  });
}
