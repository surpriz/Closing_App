import Link from "next/link";
import { useTranslations } from "next-intl";

import { BILLING_HREF } from "@/lib/billing/plans";

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
}: {
  mailboxes: { email: string; lastError: string | null }[];
  hasActive: boolean;
  /** The plan no longer sells the mailbox add-on: campaigns are paused until the workspace upgrades. */
  planBlocked?: boolean;
}) {
  const t = useTranslations("campaigns.banner");
  const te = useTranslations("campaigns.errors");
  const needsMailbox = !hasActive || mailboxes.length > 0;
  if (!needsMailbox && !planBlocked) return null;

  return (
    <div role="status" className="space-y-2 border-l-2 border-foreground bg-muted px-4 py-3 text-small">
      {planBlocked && (
        <p>
          {t("planBlocked")}{" "}
          <Link href={BILLING_HREF} className="font-medium underline underline-offset-2">
            {t("seePlans")}
          </Link>
        </p>
      )}
      {mailboxes.map(({ email, lastError }) => {
        const { code, detail } = parseLastError(lastError);
        return (
          <p key={email}>
            {t("mailboxError", { mailbox: email, error: te(code) })}
            {detail && <span className="text-muted-foreground"> ({detail})</span>}
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
