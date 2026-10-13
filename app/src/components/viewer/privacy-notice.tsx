import type { ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

// Published on the landing site (www.clozer.club)
export const PRIVACY_POLICY_URL = "https://www.clozer.club/confidentialite";
export const TERMS_URL = "https://www.clozer.club/cgu";

// GDPR transparency: the prospect is told what the sender sees before reading
export function PrivacyNotice({
  labels,
  className,
  web = false,
  video = false,
}: {
  labels: ViewerLabels;
  className?: string;
  /** URL documents are tracked as a whole, not per page. */
  web?: boolean;
  /** Video pitches are tracked by tenths of the video. */
  video?: boolean;
}) {
  return (
    <p className={cn("max-w-[68ch] text-small text-pretty text-muted-foreground", className)}>
      {video ? labels.privacyNoticeVideo : web ? labels.privacyNoticeWeb : labels.privacyNotice}{" "}
      <a
        href={PRIVACY_POLICY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline decoration-foreground/40 underline-offset-[3px] hover:decoration-foreground"
      >
        {labels.privacyLink}
      </a>
    </p>
  );
}
