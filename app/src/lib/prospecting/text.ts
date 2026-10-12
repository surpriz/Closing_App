// Text normalization shared by the matchers. Pure.

/** "Société Générale SAS" → "societe generale sas" */
export function fold(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
