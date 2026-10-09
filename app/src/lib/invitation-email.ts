import { renderEmail } from "@/lib/email-layout";

/** The email a teammate gets when a manager invites them to the workspace. Pure. */
export function buildInvitationEmail(input: { inviterName: string; workspaceName: string; url: string }) {
  const subject = `${input.inviterName} vous invite sur Clozer`;
  return {
    subject,
    ...renderEmail({
      preheader: `Rejoignez l'équipe ${input.workspaceName}`,
      title: subject,
      blocks: [
        {
          kind: "text",
          text: `Vous rejoindrez l'espace « ${input.workspaceName} » : vos propositions, qui les lit, et quand relancer.`,
        },
        { kind: "button", label: "Rejoindre l'équipe", href: input.url },
      ],
      footer: { text: "Lien valable 7 jours. Pas attendu ? Ignorez cet email." },
    }),
  };
}
