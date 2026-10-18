import type { UiLocale } from "@/i18n/locale";
import { DAY_MS } from "@/lib/closing/constants";
import { renderEmail, type EmailBlock } from "@/lib/email-layout";
import { getNamespaceTranslator } from "@/lib/server-translator";

import { BILLING_HREF } from "./plans";

/**
 * Billing emails to the workspace owners: a trial or the beta coming to an
 * end, a failed payment. Pure: which one is due, and what it says. Sending
 * lives in send-emails.ts; each kind goes once (OnboardingEmail rows).
 */

export const BILLING_EMAIL_KINDS = [
  "billing_trial_ending",
  "billing_trial_ended",
  "billing_beta_notice",
  "billing_beta_ending",
] as const;

export type BillingEmailKind = (typeof BILLING_EMAIL_KINDS)[number] | "billing_payment_failed";

export const TRIAL_ENDING_DAYS = 3;
/** Past this, "your trial is over" is old news. */
export const TRIAL_ENDED_WINDOW_DAYS = 3;
export const BETA_ENDING_DAYS = 7;

export type BillingEmailFacts = {
  trialEndsAt: Date | null;
  betaGrace: boolean;
  betaGraceUntil: Date | null;
  noticeDays: number;
  /** A plan is paid for or granted: nothing to announce. */
  subscribed: boolean;
  sent: ReadonlySet<string>;
};

/** The one email due now, most urgent first; null when nothing is. */
export function dueBillingEmail(facts: BillingEmailFacts, now: Date): BillingEmailKind | null {
  if (facts.subscribed) return null;
  const due = (kind: BillingEmailKind, when: boolean) => when && !facts.sent.has(kind);
  const daysTo = (date: Date) => (date.getTime() - now.getTime()) / DAY_MS;

  const until = facts.betaGrace ? facts.betaGraceUntil : null;
  if (until && daysTo(until) > 0) {
    if (due("billing_beta_ending", daysTo(until) <= BETA_ENDING_DAYS)) return "billing_beta_ending";
    if (due("billing_beta_notice", daysTo(until) <= facts.noticeDays)) return "billing_beta_notice";
  }
  // On the beta grace, the trial changes nothing: say nothing about it
  const betaActive = facts.betaGrace && (!facts.betaGraceUntil || daysTo(facts.betaGraceUntil) > 0);
  if (facts.trialEndsAt && !betaActive) {
    const left = daysTo(facts.trialEndsAt);
    if (due("billing_trial_ending", left > 0 && left <= TRIAL_ENDING_DAYS)) return "billing_trial_ending";
    if (due("billing_trial_ended", left <= 0 && -left <= TRIAL_ENDED_WINDOW_DAYS)) return "billing_trial_ended";
  }
  return null;
}

export type BillingEmailData = {
  appUrl: string;
  firstName: string | null;
  locale: UiLocale;
  /** The trial or beta end. */
  endsAt?: Date | null;
  now: Date;
};

export function buildBillingEmail(kind: BillingEmailKind, data: BillingEmailData) {
  const t = getNamespaceTranslator(data.locale, "emails.billing");
  const hello = data.firstName ? t("helloName", { name: data.firstName }) : t("hello");
  const date = data.endsAt
    ? new Intl.DateTimeFormat(data.locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long" }).format(data.endsAt)
    : "";
  const days = data.endsAt ? Math.max(1, Math.ceil((data.endsAt.getTime() - data.now.getTime()) / DAY_MS)) : 0;
  const button = (label: string): EmailBlock => ({ kind: "button", label, href: `${data.appUrl}${BILLING_HREF}` });

  const content = ((): { subject: string; title: string; blocks: EmailBlock[] } => {
    switch (kind) {
      case "billing_trial_ending":
        return {
          subject: t("trialEnding.subject", { days }),
          title: t("trialEnding.title", { date }),
          blocks: [
            { kind: "text", text: hello },
            { kind: "text", text: t("trialEnding.body") },
            { kind: "text", text: t("afterFree") },
            button(t("choose")),
          ],
        };
      case "billing_trial_ended":
        return {
          subject: t("trialEnded.subject"),
          title: t("trialEnded.title"),
          blocks: [
            { kind: "text", text: hello },
            { kind: "text", text: t("trialEnded.body") },
            { kind: "text", text: t("afterFree") },
            button(t("choose")),
          ],
        };
      case "billing_beta_notice":
        return {
          subject: t("betaNotice.subject"),
          title: t("betaNotice.title", { date }),
          blocks: [
            { kind: "text", text: hello },
            { kind: "text", text: t("betaNotice.body", { date }) },
            { kind: "text", text: t("betaNotice.prices") },
            { kind: "text", text: t("afterFree") },
            button(t("seePlans")),
          ],
        };
      case "billing_beta_ending":
        return {
          subject: t("betaEnding.subject", { date }),
          title: t("betaEnding.title", { date }),
          blocks: [
            { kind: "text", text: hello },
            { kind: "text", text: t("betaEnding.body", { date }) },
            { kind: "text", text: t("afterFree") },
            button(t("choose")),
          ],
        };
      case "billing_payment_failed":
        return {
          subject: t("paymentFailed.subject"),
          title: t("paymentFailed.title"),
          blocks: [
            { kind: "text", text: hello },
            { kind: "text", text: t("paymentFailed.body") },
            button(t("paymentFailed.button")),
          ],
        };
    }
  })();

  const { html, text } = renderEmail({
    locale: data.locale,
    preheader: content.blocks.flatMap((block, i) => (i > 0 && block.kind === "text" ? [block.text] : []))[0],
    title: content.title,
    blocks: content.blocks,
  });
  return { subject: content.subject, html, text };
}
