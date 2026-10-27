/** Representative IANA zone per ISO-3166 alpha-2 code. */
export const COUNTRY_TIMEZONES: Record<string, string> = {
  FR: "Europe/Paris",
  BE: "Europe/Brussels",
  CH: "Europe/Zurich",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  IT: "Europe/Rome",
  PT: "Europe/Lisbon",
  NL: "Europe/Amsterdam",
  GB: "Europe/London",
  IE: "Europe/Dublin",
  LU: "Europe/Luxembourg",
  AT: "Europe/Vienna",
  DK: "Europe/Copenhagen",
  SE: "Europe/Stockholm",
  NO: "Europe/Oslo",
  FI: "Europe/Helsinki",
  PL: "Europe/Warsaw",
  US: "America/New_York",
  CA: "America/Toronto",
  MA: "Africa/Casablanca",
  TN: "Africa/Tunis",
  DZ: "Africa/Algiers",
  SN: "Africa/Dakar",
  CI: "Africa/Abidjan",
  AE: "Asia/Dubai",
  IL: "Asia/Jerusalem",
  IN: "Asia/Kolkata",
  AU: "Australia/Sydney",
};

const COUNTRY_NAMES: Record<string, string> = {
  france: "FR",
  belgique: "BE",
  belgium: "BE",
  suisse: "CH",
  switzerland: "CH",
  allemagne: "DE",
  germany: "DE",
  espagne: "ES",
  spain: "ES",
  italie: "IT",
  italy: "IT",
  portugal: "PT",
  "pays-bas": "NL",
  "pays bas": "NL",
  netherlands: "NL",
  "royaume-uni": "GB",
  "royaume uni": "GB",
  "united kingdom": "GB",
  uk: "GB",
  irlande: "IE",
  ireland: "IE",
  luxembourg: "LU",
  autriche: "AT",
  austria: "AT",
  danemark: "DK",
  denmark: "DK",
  suede: "SE",
  sweden: "SE",
  norvege: "NO",
  norway: "NO",
  finlande: "FI",
  finland: "FI",
  pologne: "PL",
  poland: "PL",
  "etats-unis": "US",
  "etats unis": "US",
  "united states": "US",
  usa: "US",
  canada: "CA",
  maroc: "MA",
  morocco: "MA",
  tunisie: "TN",
  tunisia: "TN",
  algerie: "DZ",
  algeria: "DZ",
  senegal: "SN",
  "cote d'ivoire": "CI",
  "ivory coast": "CI",
  emirats: "AE",
  uae: "AE",
  israel: "IL",
  inde: "IN",
  india: "IN",
  australie: "AU",
  australia: "AU",
};

function isIana(value: string) {
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function detectCountryTimezone(value: string | null | undefined, fallback: string): string {
  const raw = value?.trim();
  if (!raw) return fallback;
  if ((raw.includes("/") || /^(utc|gmt)$/i.test(raw)) && isIana(raw)) return raw;
  const key = raw
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/’/g, "'")
    .toLowerCase();
  const upper = key.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && COUNTRY_TIMEZONES[upper]) return COUNTRY_TIMEZONES[upper];
  const code = COUNTRY_NAMES[key];
  return code ? COUNTRY_TIMEZONES[code] : fallback;
}
