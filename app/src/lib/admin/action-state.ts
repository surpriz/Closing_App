import { isAPIError } from "better-auth/api";
import { z } from "zod";

export type AdminActionState = { ok?: boolean; error?: string } | null;

// Better Auth's admin plugin errors, in the French the rest of the UI speaks
const MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: "Utilisateur introuvable.",
  YOU_CANNOT_BAN_YOURSELF: "Vous ne pouvez pas vous désactiver vous-même.",
  YOU_CANNOT_IMPERSONATE_ADMINS: "Impossible de se connecter en tant qu'admin.",
};

export function adminErrorMessage(error: unknown): string {
  const code = isAPIError(error) ? (error.body as { code?: string } | undefined)?.code : undefined;
  if (code && MESSAGES[code]) return MESSAGES[code];
  console.error("[admin]", error);
  return "Ça n'a pas marché, réessayez.";
}

const reasonSchema = z.string().trim().min(3, "Indiquez un motif.").max(500, "Motif trop long.");

/** The required "Motif" field of the admin dialogs. */
export function parseReason(formData: FormData): { reason: string } | { error: string } {
  const parsed = reasonSchema.safeParse(formData.get("reason"));
  return parsed.success ? { reason: parsed.data } : { error: parsed.error.issues[0]?.message ?? "Motif invalide." };
}
