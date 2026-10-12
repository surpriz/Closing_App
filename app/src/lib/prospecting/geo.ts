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

const REGION_DEPARTEMENTS: Record<string, string[]> = {
  "84": ["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"],
  "27": ["21", "25", "39", "58", "70", "71", "89", "90"],
  "53": ["22", "29", "35", "56"],
  "24": ["18", "28", "36", "37", "41", "45"],
  "94": ["2A", "2B"],
  "44": ["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"],
  "32": ["02", "59", "60", "62", "80"],
  "11": ["75", "77", "78", "91", "92", "93", "94", "95"],
  "28": ["14", "27", "50", "61", "76"],
  "75": ["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"],
  "76": ["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"],
  "52": ["44", "49", "53", "72", "85"],
  "93": ["04", "05", "06", "13", "83", "84"],
  "01": ["971"],
  "02": ["972"],
  "03": ["973"],
  "04": ["974"],
  "06": ["976"],
};

const DEPARTEMENT_REGION = new Map(
  Object.entries(REGION_DEPARTEMENTS).flatMap(([region, codes]) => codes.map((code) => [code, region] as const)),
);

export function regionOfDepartement(code: string) {
  return DEPARTEMENT_REGION.get(code) ?? null;
}

/** Region names for providers that search by place name: listed regions plus those of listed departements. */
export function placeNames(target: { regions: string[]; departements: string[] }) {
  const codes = new Set([
    ...target.regions,
    ...target.departements.map(regionOfDepartement).filter((c): c is string => !!c),
  ]);
  return [...codes].map((code) => REGIONS[code]).filter(Boolean);
}
