import type { FollowupTrigger } from "@/generated/prisma/enums";

export type FollowupDraftInput = {
  trigger: FollowupTrigger;
  channel: "EMAIL" | "WHATSAPP";
  locale: string;
  prospectName: string | null;
  company: string | null;
  documentName: string;
  proposalUrl: string;
  senderName: string | null;
  senderSignature: string | null;
  daysSinceSent: number | null;
  /** When the link stops opening, worded for the prospect ("jeudi 15 octobre à 18:00"). */
  deadlineLabel?: string | null;
};

export type FollowupDraft = { subject: string | null; body: string };

function firstName(name: string | null) {
  return name?.trim().split(/\s+/)[0] || null;
}

// Used when no AI provider is configured or the AI call fails. Never mentions
// reading analytics: follow-ups must not feel like surveillance.
export function templateFollowup(input: FollowupDraftInput): FollowupDraft {
  const fr = input.locale.toLowerCase().startsWith("fr");
  const name = firstName(input.prospectName);
  const signature = input.senderSignature ?? input.senderName ?? "";
  const whatsapp = input.channel === "WHATSAPP";

  if (fr) {
    const hello = name ? `Bonjour ${name},` : "Bonjour,";
    const body =
      input.trigger === "EXPIRY_REMINDER" && input.deadlineLabel
        ? `${hello}\n\nPetit rappel : « ${input.documentName} » reste accessible jusqu'au ${input.deadlineLabel}. Si vous avez des questions ou besoin d'un peu plus de temps, dites-le-moi d'ici là.\n\nLe document : ${input.proposalUrl}`
        : input.trigger === "HOT_PRICING"
        ? `${hello}\n\nJe reviens vers vous au sujet de « ${input.documentName} ». Si certains points de la partie tarifaire méritent d'être précisés, ou si un paiement échelonné vous arrangerait, on peut en parler rapidement.\n\nLa proposition reste accessible ici : ${input.proposalUrl}`
        : `${hello}\n\nPetit rappel concernant « ${input.documentName} ». Je reste disponible pour un échange de 15 minutes si c'est plus simple pour en discuter.\n\nLe document : ${input.proposalUrl}`;

    return {
      subject: whatsapp ? null : `${input.documentName} – un point rapide ?`,
      body: signature && !whatsapp ? `${body}\n\n${signature}` : body,
    };
  }

  const hello = name ? `Hi ${name},` : "Hi,";
  const body =
    input.trigger === "EXPIRY_REMINDER" && input.deadlineLabel
      ? `${hello}\n\nA quick reminder: "${input.documentName}" stays available until ${input.deadlineLabel}. If you have questions or need a bit more time, just let me know before then.\n\nThe link: ${input.proposalUrl}`
      : input.trigger === "HOT_PRICING"
      ? `${hello}\n\nFollowing up on "${input.documentName}". If anything in the pricing needs clarifying, or if a staged payment plan would help, happy to walk you through the options.\n\nThe proposal is here: ${input.proposalUrl}`
      : `${hello}\n\nJust a quick reminder about "${input.documentName}". Happy to jump on a 15-minute call if that's easier.\n\nThe link: ${input.proposalUrl}`;

  return {
    subject: whatsapp ? null : `${input.documentName} – quick follow-up`,
    body: signature && !whatsapp ? `${body}\n\n${signature}` : body,
  };
}
