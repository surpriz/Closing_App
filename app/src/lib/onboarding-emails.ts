import { renderEmail, type EmailBlock } from "@/lib/email-layout";

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
};

export function buildOnboardingEmail(kind: OnboardingEmailKind, data: OnboardingEmailData) {
  const hello = data.firstName ? `Bonjour ${data.firstName},` : "Bonjour,";
  const { subject, title, blocks } = content(kind, data, hello);
  const { html, text } = renderEmail({
    preheader: blocks.find((block) => block.kind === "text")?.text,
    title,
    blocks,
    footer: { text: "Ne plus recevoir ces conseils de démarrage", href: `${data.appUrl}/bienvenue/emails` },
  });
  return { subject, html, text };
}

function content(
  kind: OnboardingEmailKind,
  data: OnboardingEmailData,
  hello: string,
): { subject: string; title: string; blocks: EmailBlock[] } {
  switch (kind) {
    case "welcome":
      return {
        subject: "Bienvenue sur Clozer",
        title: "Une seule chose à faire",
        blocks: [
          { kind: "text", text: hello },
          {
            kind: "text",
            text: "Déposez un devis, puis ouvrez le lien comme le ferait votre prospect. Vous verrez tout de suite ce que Clozer vous montre. Deux minutes.",
          },
          { kind: "text", text: "Rien à installer, tout se fait dans votre navigateur." },
          { kind: "button", label: "C'est parti", href: `${data.appUrl}/bienvenue` },
        ],
      };
    case "no_document":
      return {
        subject: "Votre premier document sur Clozer",
        title: "Prenez le dernier devis que vous avez envoyé",
        blocks: [
          { kind: "text", text: hello },
          {
            kind: "text",
            text: "Même un vieux. Déposez-le dans Clozer et ouvrez le lien : vous verrez exactement ce que votre prospect verra, et ce que vous saurez de sa lecture.",
          },
          { kind: "text", text: "Pas de document sous la main ? Un exemple vous attend." },
          { kind: "button", label: "Essayer maintenant", href: `${data.appUrl}/bienvenue` },
        ],
      };
    case "not_sent":
      return {
        subject: "Votre lien est prêt, il n'est pas encore parti",
        title: "Votre lien attend son prospect",
        blocks: [
          { kind: "text", text: hello },
          {
            kind: "text",
            text: "Copiez-le dans votre prochain email, à la place de la pièce jointe. Dès que votre prospect l'ouvre, vous le savez.",
          },
          { kind: "button", label: "Récupérer mon lien", href: `${data.appUrl}/dashboard` },
        ],
      };
    case "first_read": {
      const label = data.deal?.label ?? "Un prospect";
      return {
        subject: `${label} a ouvert votre document`,
        title: `${label} a ouvert votre document`,
        blocks: [
          { kind: "text", text: hello },
          {
            kind: "text",
            text: "Votre premier lien a été lu. Sur la page du deal : les pages lues, le temps passé, et ce que Clozer en conclut.",
          },
          {
            kind: "text",
            text: "Si une relance est utile, Clozer l'écrit pour vous. Elle vous attend dans « Relances à valider », rien ne part sans vous.",
          },
          { kind: "button", label: "Voir ce qu'il a lu", href: data.deal?.url ?? `${data.appUrl}/dashboard` },
        ],
      };
    }
  }
}
