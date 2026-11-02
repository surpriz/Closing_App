import Link from "next/link";
import { useTranslations } from "next-intl";

import type { MailboxProvider } from "@/generated/prisma/enums";
import { BILLING_HREF } from "@/lib/billing/plans";
import { mailboxErrorKey, providerLabel } from "@/lib/mailboxes/error-copy";

const ERROR_CODES = ["AUTH_REVOKED", "QUOTA", "RATE_LIMITED", "REJECTED", "TRANSIENT", "CONFIG", "POLICY"] as const;
type ErrorCode = (typeof ERROR_CODES)[number];

/** `lastError` is "<CODE>: <detail>" (D7): the code is translated, the detail stays as the server wrote it. */
function parseLastError(value: string | null): { code: ErrorCode | "unknown"; detail: string } {
  const match = value ? /^([A-Z_]+):\s*([\s\S]*)$/.exec(value) : null;
  const code = match?.[1];
  if (match && code && (ERROR_CODES as readonly string[]).includes(code)) {
    return { code: code as ErrorCode, detail: match[2].trim() };
  }
  return { code: "unknown", detail: value?.trim() ?? "" };
}

/** What blocks sending: no usable mailbox at all, or mailboxes in error. Renders nothing when all is well. */
export function MailboxBanner({
  mailboxes,
  hasActive,
  planBlocked = false,
  campaignsRunning = true,
  lead,
}: {
  mailboxes: { email: string; lastError: string | null; provider: MailboxProvider }[];
  hasActive: boolean;
  /** The plan no longer sells the mailbox add-on: campaigns are paused until the workspace upgrades. */
  planBlocked?: boolean;
  /** At least one campaign is ACTIVE: "paused" is true only then, otherwise the line just says what sending takes. */
  campaignsRunning?: boolean;
  /** What the error costs here, e.g. on Today: "your campaigns and their follow-ups are paused". */
  lead?: string;
}) {
  const t = useTranslations("campaigns.banner");
  const te = useTranslations("campaigns.errors");
  const needsMailbox = !hasActive || mailboxes.length > 0;
  if (!needsMailbox && !planBlocked) return null;

  return (
    <div role="status" className="space-y-2 border-l-2 border-foreground bg-muted px-4 py-3 text-small">
      {lead && mailboxes.length > 0 && <p className="font-medium">{lead}</p>}
      {planBlocked && (
        <p>
          {t(campaignsRunning ? "planBlocked" : "planNeeded")}{" "}
          <Link href={BILLING_HREF} className="font-medium underline underline-offset-2">
            {t("seePlans")}
          </Link>
        </p>
      )}
      {mailboxes.map(({ email, lastError, provider }) => {
        const { code, detail } = parseLastError(lastError);
        // The raw provider detail ("unipile CREDENTIALS") helps support, not the seller: kept on hover only
        return (
          <p key={email} title={detail || undefined}>
            {t("mailboxError", {
              mailbox: email,
              error: te(mailboxErrorKey(code, provider), { provider: providerLabel(provider) }),
            })}
          </p>
        );
      })}
      {!hasActive && mailboxes.length === 0 && !planBlocked && <p>{t("noMailbox")}</p>}
      {needsMailbox && (
        <Link href="/settings#boite" className="font-medium underline underline-offset-2">
          {mailboxes.length > 0 ? t("fix") : t("connect")}
        </Link>
      )}
    </div>
  );
}
