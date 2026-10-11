// French regions (INSEE codes since 2016). Pure.

export const REGIONS: Record<string, string> = {
  "01": "Guadeloupe",
  "02": "Martinique",
  "03": "Guyane",
  "04": "La Réunion",
  "06": "Mayotte",
  "11": "Île-de-France",
  "24": "Centre-Val de Loire",
  "27": "Bourgogne-Franche-Comté",
  "28": "Normandie",
  "32": "Hauts-de-France",
  "44": "Grand Est",
  "52": "Pays de la Loire",
  "53": "Bretagne",
  "75": "Nouvelle-Aquitaine",
  "76": "Occitanie",
  "84": "Auvergne-Rhône-Alpes",
  "93": "Provence-Alpes-Côte d'Azur",
  "94": "Corse",
};

export function regionName(code: string) {
  return REGIONS[code] ?? null;
}

/** "69", "2A", "974" */
export function isDepartementCode(value: string) {
  return /^(\d{2}|2[AB]|97\d)$/.test(value);
}
