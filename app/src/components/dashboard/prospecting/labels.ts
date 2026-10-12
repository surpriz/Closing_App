export const PROVIDER_LABELS: Record<string, string> = { APOLLO: "Apollo", LEMLIST: "Lemlist", MOCK: "Démo" };

export const STATUS_LABELS: Record<string, string> = {
  SUGGESTED: "À trier",
  ACCEPTED: "Accepté",
  REVEALING: "Révélation…",
  READY: "Prêt",
  INVALID: "Indisponible",
  REJECTED: "Écarté",
};

export const INVALID_LABELS: Record<string, string> = {
  NOT_FOUND: "Email introuvable",
  UNVERIFIED: "Email non vérifié",
  PERSONAL: "Email personnel, écarté",
  DUPLICATE: "Déjà dans vos prospects",
  OPTED_OUT: "Ne souhaite pas être contacté",
};
