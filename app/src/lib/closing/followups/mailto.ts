/**
 * A mailto: link that opens the seller's own mail client with the follow-up
 * filled in. Some clients truncate or refuse long URLs, so past a safe length
 * we return null and the UI falls back to copying the text.
 */

/** Below the limits of Outlook desktop (~2000) and old Gmail handlers. */
export const MAILTO_MAX_LENGTH = 1800;

export function buildMailto({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string | null;
  body: string;
}): string | null {
  const params = [
    subject ? `subject=${encodeURIComponent(subject)}` : null,
    // RFC 6068: line breaks must be CRLF
    `body=${encodeURIComponent(body.replace(/\r?\n/g, "\r\n"))}`,
  ].filter(Boolean);
  const url = `mailto:${encodeURIComponent(to).replace(/%40/g, "@")}?${params.join("&")}`;
  return url.length <= MAILTO_MAX_LENGTH ? url : null;
}
