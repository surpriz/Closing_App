import type { MetadataRoute } from "next";

const BASE = "https://www.clozer.club";

// The legal pages show "Mise à jour le …"; keep these in step with their updatedAt.
const LEGAL_UPDATED_AT = new Date("2026-10-11");
const PRIVACY_UPDATED_AT = new Date("2026-10-13");
const SUPPORT_UPDATED_AT = new Date("2026-10-13");
// Last copy change on the home page.
const HOME_UPDATED_AT = new Date("2026-10-12");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${BASE}/`,
      lastModified: HOME_UPDATED_AT,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE}/cgu`,
      lastModified: LEGAL_UPDATED_AT,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/confidentialite`,
      lastModified: PRIVACY_UPDATED_AT,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/sous-traitants`,
      lastModified: LEGAL_UPDATED_AT,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/mentions-legales`,
      lastModified: LEGAL_UPDATED_AT,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${BASE}/support`,
      lastModified: SUPPORT_UPDATED_AT,
      changeFrequency: "monthly",
      priority: 0.4,
    },
  ];
}
