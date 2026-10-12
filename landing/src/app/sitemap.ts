import type { MetadataRoute } from "next";

const BASE = "https://www.clozer.club";

// The legal pages show "Mise à jour le 11 octobre 2026"; keep these in step with their updatedAt.
const LEGAL_UPDATED_AT = new Date("2026-10-11");
// Last copy change on the home page.
const HOME_UPDATED_AT = new Date("2026-10-12");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: `${BASE}/`, lastModified: HOME_UPDATED_AT, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/cgu`, lastModified: LEGAL_UPDATED_AT, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/confidentialite`, lastModified: LEGAL_UPDATED_AT, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/sous-traitants`, lastModified: LEGAL_UPDATED_AT, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE}/mentions-legales`, lastModified: LEGAL_UPDATED_AT, changeFrequency: "yearly", priority: 0.3 },
  ];
}
