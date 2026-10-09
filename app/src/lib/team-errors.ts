import { isAPIError } from "better-auth/api";

// Better Auth's organization errors, as a seller should read them
const MESSAGES: Record<string, string> = {
  USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: "Cette personne fait déjà partie de l'équipe.",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: "Seuls les administrateurs peuvent inviter.",
  YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: "Seul le propriétaire peut donner ce rôle.",
  YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: "Vous ne pouvez pas modifier ce membre.",
  YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: "Vous ne pouvez pas retirer ce membre.",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: "L'espace doit garder au moins un propriétaire.",
  YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: "L'espace doit garder au moins un propriétaire.",
  YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: "Vous ne pouvez pas annuler cette invitation.",
  MEMBER_NOT_FOUND: "Ce membre n'est plus dans l'équipe.",
  INVITATION_NOT_FOUND: "Cette invitation n'est plus valable.",
  YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: "Cette invitation est pour une autre adresse email.",
  INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: "La personne qui vous a invité a quitté l'équipe. Demandez une nouvelle invitation.",
};

export function teamErrorMessage(error: unknown, fallback = "Ça n'a pas marché, réessayez.") {
  if (isAPIError(error)) {
    const code = (error.body as { code?: string } | undefined)?.code;
    if (code && MESSAGES[code]) return MESSAGES[code];
  }
  console.error("[team]", error);
  return fallback;
}
