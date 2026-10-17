import type { UiLocale } from "@/i18n/locale";
import { renderEmail, type EmailBlock } from "@/lib/email-layout";
import { getNamespaceTranslator, type ServerT } from "@/lib/server-translator";

/**
 * Getting-started emails: one idea each, sent once, only while still true.
 * Pure: which one is due, and what it says. Sending lives in
 * closing/onboarding-emails.ts.
 */

export const ONBOARDING_EMAIL_KINDS = ["welcome", "no_document", "not_sent", "first_read"] as const;

export type OnboardingEmailKind = (typeof ONBOARDING_EMAIL_KINDS)[number];

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/** Past these, a nudge is old news: the seller either came back or moved on. */
export const WELCOME_WINDOW_MS = 2 * DAY_MS;
export const NO_DOCUMENT_AFTER_MS = DAY_MS;
export const NOT_SENT_AFTER_MS = 2 * DAY_MS;
export const NUDGE_WINDOW_MS = 7 * DAY_MS;
export const FIRST_READ_WINDOW_MS = 2 * DAY_MS;

export type OnboardingFacts = {
  /** When the seller joined this workspace. */
  joinedAt: Date;
  sent: ReadonlySet<OnboardingEmailKind>;
  off: boolean;
  /** Archived ones included: a seller who dropped a document is past "no document". */
  firstDocumentAt: Date | null;
  /** A real link (not a draft, not the tour's test) went to a prospect. */
  hasSentLink: boolean;
  /** First prospect read on a real link. */
  firstReadAt: Date | null;
};

/** The one email to send now, most useful first; null when nothing is due. */
export function dueOnboardingEmail(facts: OnboardingFacts, now: Date): OnboardingEmailKind | null {
  if (facts.off) return null;
  const since = (date: Date) => now.getTime() - date.getTime();
  const due = (kind: OnboardingEmailKind, when: boolean) => when && !facts.sent.has(kind);

  if (due("first_read", !!facts.firstReadAt && since(facts.firstReadAt!) <= FIRST_READ_WINDOW_MS)) return "first_read";
  if (
    due(
      "not_sent",
      !!facts.firstDocumentAt &&
        !facts.hasSentLink &&
        !facts.firstReadAt &&
        since(facts.firstDocumentAt!) >= NOT_SENT_AFTER_MS &&
        since(facts.firstDocumentAt!) <= NUDGE_WINDOW_MS,
    )
  ) {
    return "not_sent";
  }
  const joined = since(facts.joinedAt);
  if (due("no_document", !facts.firstDocumentAt && joined >= NO_DOCUMENT_AFTER_MS && joined <= NUDGE_WINDOW_MS)) {
    return "no_document";
  }
  if (due("welcome", joined <= WELCOME_WINDOW_MS)) return "welcome";
  return null;
}

export type OnboardingEmailData = {
  appUrl: string;
  firstName: string | null;
  /** first_read: the deal that was opened. */
  deal?: { label: string | null; url: string };
  locale: UiLocale;
};

type EmailT = ServerT<"emails.onboarding">;

export function buildOnboardingEmail(kind: OnboardingEmailKind, data: OnboardingEmailData) {
  const tt = getNamespaceTranslator(data.locale, "emails.onboarding");
  const hello = data.firstName ? tt("helloName", { name: data.firstName }) : tt("hello");
  const { subject, title, blocks } = content(kind, data, hello, tt);
  const { html, text } = renderEmail({
    locale: data.locale,
    preheader: blocks.find((block) => block.kind === "text")?.text,
    title,
    blocks,
    footer: { text: tt("footer"), href: `${data.appUrl}/welcome/emails` },
  });
  return { subject, html, text };
}

function content(
  kind: OnboardingEmailKind,
  data: OnboardingEmailData,
  hello: string,
  t: EmailT,
): { subject: string; title: string; blocks: EmailBlock[] } {
  switch (kind) {
    case "welcome":
      return {
        subject: t("welcome.subject"),
        title: t("welcome.title"),
        blocks: [
          { kind: "text", text: hello },
          { kind: "text", text: t("welcome.body") },
          { kind: "text", text: t("welcome.noInstall") },
          { kind: "button", label: t("welcome.button"), href: `${data.appUrl}/welcome` },
        ],
      };
    case "no_document":
      return {
        subject: t("noDocument.subject"),
        title: t("noDocument.title"),
        blocks: [
          { kind: "text", text: hello },
          { kind: "text", text: t("noDocument.body") },
          { kind: "text", text: t("noDocument.example") },
          { kind: "button", label: t("noDocument.button"), href: `${data.appUrl}/welcome` },
        ],
      };
    case "not_sent":
      return {
        subject: t("notSent.subject"),
        title: t("notSent.title"),
        blocks: [
          { kind: "text", text: hello },
          { kind: "text", text: t("notSent.body") },
          { kind: "button", label: t("notSent.button"), href: `${data.appUrl}/dashboard` },
        ],
      };
    case "first_read": {
      const label = data.deal?.label ?? t("firstRead.someone");
      return {
        subject: t("firstRead.subject", { label }),
        title: t("firstRead.subject", { label }),
        blocks: [
          { kind: "text", text: hello },
          { kind: "text", text: t("firstRead.body") },
          { kind: "text", text: t("firstRead.followup") },
          { kind: "button", label: t("firstRead.button"), href: data.deal?.url ?? `${data.appUrl}/dashboard` },
        ],
      };
    }
  }
}
