import type { UserStatus } from "@/lib/platform-admin";

export const ADMIN_PAGE_SIZE = 50;

/** ?page=N from the URL, 1 when missing or nonsense. */
export function parsePage(value: string | string[] | undefined) {
  const page = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

export function firstParam(value: string | string[] | undefined) {
  return (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
}

export const USER_STATUS_LABELS: Record<UserStatus, string> = {
  active: "Actif",
  disabled: "Désactivé",
  banned: "Banni",
};

export const ADMIN_ACTION_LABELS = {
  "user.disable": "Compte désactivé",
  "user.ban": "Compte banni",
  "user.reactivate": "Compte réactivé",
  "user.revoke_sessions": "Sessions révoquées",
  "user.impersonate": "Connexion en tant que",
  "user.delete": "Compte supprimé",
  "organization.suspend": "Espace suspendu",
  "organization.reactivate": "Espace réactivé",
  "settings.signup_mode": "Mode d'inscription changé",
  "settings.allow_email": "Email autorisé",
  "settings.disallow_email": "Email retiré des autorisés",
  "settings.block_email": "Email bloqué",
  "settings.unblock_email": "Email débloqué",
} as const;

export type AdminAction = keyof typeof ADMIN_ACTION_LABELS;

export const adminDate = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" });
export const adminDateTime = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

const usd = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "USD", maximumFractionDigits: 2 });

/** AiUsage stores millionths of a dollar. */
export function formatMicroUsd(micro: number) {
  return usd.format(micro / 1_000_000);
}

/** URL filters: ?statut=key, each key with its label in the dropdown. */
export type FilterMap = Record<string, { label: string }>;

export function parseFilter<M extends FilterMap>(filters: M, value: string | undefined): keyof M & string | undefined {
  return value !== undefined && Object.hasOwn(filters, value) ? value : undefined;
}

export function filterOptions(filters: FilterMap) {
  return Object.entries(filters).map(([value, { label }]) => ({ value, label }));
}

export function plural(count: number, word: string) {
  return count > 1 ? `${word}s` : word;
}

/** The useful bit of an audit line's metadata: which email, which mode, how long. */
export function auditDetail(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const data = metadata as { email?: unknown; mode?: unknown; days?: unknown };
  if (typeof data.email === "string") return data.email;
  if (data.mode === "open") return "ouvertes à tous";
  if (data.mode === "invite_only") return "sur invitation";
  if (typeof data.days === "number") return `${data.days} ${plural(data.days, "jour")}`;
  if ("days" in data && data.days === null) return "jusqu'à réactivation";
  return null;
}
