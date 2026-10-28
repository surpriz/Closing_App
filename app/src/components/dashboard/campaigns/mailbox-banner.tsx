import Link from "next/link";
import { useTranslations } from "next-intl";

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
}: {
  mailboxes: { email: string; lastError: string | null }[];
  hasActive: boolean;
}) {
  const t = useTranslations("campaigns.banner");
  const te = useTranslations("campaigns.errors");
  if (hasActive && mailboxes.length === 0) return null;

  return (
    <div role="status" className="space-y-2 border-l-2 border-foreground bg-muted px-4 py-3 text-small">
      {mailboxes.map(({ email, lastError }) => {
        const { code, detail } = parseLastError(lastError);
        return (
          <p key={email}>
            {t("mailboxError", { mailbox: email, error: te(code) })}
            {detail && <span className="text-muted-foreground"> ({detail})</span>}
          </p>
        );
      })}
      {!hasActive && mailboxes.length === 0 && <p>{t("noMailbox")}</p>}
      <Link href="/settings#boite" className="font-medium underline underline-offset-2">
        {mailboxes.length > 0 ? t("fix") : t("connect")}
      </Link>
    </div>
  );
}
