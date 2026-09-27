import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

// Published on the landing site (www.clozer.club)
export const PRIVACY_POLICY_URL = "https://www.clozer.club/confidentialite";

// GDPR transparency: the prospect is told what the sender sees before reading
export function PrivacyNotice({ labels, className }: { labels: ViewerLabels; className?: string }) {
  return (
    <p className={`text-xs leading-relaxed text-muted-foreground ${className ?? ""}`}>
      {labels.privacyNotice}{" "}
      <a
        href={PRIVACY_POLICY_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        {labels.privacyLink}
      </a>
    </p>
  );
}
