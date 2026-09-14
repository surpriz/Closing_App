export type FollowupDraftInput = {
  trigger: "HOT_PRICING" | "ANTI_GHOSTING" | "MANUAL";
  channel: "EMAIL" | "WHATSAPP";
  locale: string;
  prospectName: string | null;
  company: string | null;
  documentName: string;
  proposalUrl: string;
  senderName: string | null;
  senderSignature: string | null;
  daysSinceSent: number | null;
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
      input.trigger === "HOT_PRICING"
        ? `${hello}\n\nJe reviens vers vous au sujet de « ${input.documentName} ». Si certains points de la partie tarifaire méritent d'être précisés, ou si un paiement échelonné vous arrangerait, on peut en parler rapidement.\n\nLa proposition reste accessible ici : ${input.proposalUrl}`
        : `${hello}\n\nPetit rappel concernant « ${input.documentName} » que je vous ai envoyée. Je reste disponible pour un échange de 15 minutes si c'est plus simple pour en discuter.\n\nLe document : ${input.proposalUrl}`;

    return {
      subject: whatsapp ? null : `${input.documentName} – un point rapide ?`,
      body: signature && !whatsapp ? `${body}\n\n${signature}` : body,
    };
  }

  const hello = name ? `Hi ${name},` : "Hi,";
  const body =
    input.trigger === "HOT_PRICING"
      ? `${hello}\n\nFollowing up on "${input.documentName}". If anything in the pricing needs clarifying, or if a staged payment plan would help, happy to walk you through the options.\n\nThe proposal is here: ${input.proposalUrl}`
      : `${hello}\n\nJust a quick reminder about "${input.documentName}". Happy to jump on a 15-minute call if that's easier.\n\nThe proposal: ${input.proposalUrl}`;

  return {
    subject: whatsapp ? null : `${input.documentName} – quick follow-up`,
    body: signature && !whatsapp ? `${body}\n\n${signature}` : body,
  };
}
