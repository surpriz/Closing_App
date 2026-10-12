// French company registry: recherche-entreprises.api.gouv.fr (free, no key, 7 requests/s per IP).
// No website field and no search by domain: companies are found by name.

const BASE_URL = "https://recherche-entreprises.api.gouv.fr/search";
const SPACING_MS = 160;

export type RegistryCompany = {
  siren: string;
  names: string[];
  naf: string | null;
  headcountCode: string | null;
  departement: string | null;
  region: string | null;
};

type ApiResult = {
  siren: string;
  nom_complet?: string | null;
  nom_raison_sociale?: string | null;
  sigle?: string | null;
  activite_principale?: string | null;
  tranche_effectif_salarie?: string | null;
  siege?: {
    departement?: string | null;
    region?: string | null;
    nom_commercial?: string | null;
    liste_enseignes?: string[] | null;
  } | null;
};

export function toRegistryCompany(result: ApiResult): RegistryCompany {
  const siege = result.siege ?? {};
  const names = [
    result.nom_raison_sociale,
    result.nom_complet,
    result.sigle,
    siege.nom_commercial,
    ...(siege.liste_enseignes ?? []),
  ].filter((name): name is string => !!name?.trim());
  return {
    siren: result.siren,
    names: [...new Set(names)],
    naf: result.activite_principale ?? null,
    headcountCode: result.tranche_effectif_salarie ?? null,
    departement: siege.departement ?? null,
    region: siege.region ?? null,
  };
}

// Requests from one server instance are spaced out to stay under the rate limit
let queue: Promise<unknown> = Promise.resolve();

function spaced<T>(task: () => Promise<T>) {
  const next = queue.then(task, task);
  queue = next.then(
    () => new Promise((resolve) => setTimeout(resolve, SPACING_MS)),
    () => new Promise((resolve) => setTimeout(resolve, SPACING_MS)),
  );
  return next;
}

/** Active companies matching a name, best first. Throws on network or API errors. */
export async function searchCompanies(query: { name: string; departement?: string | null; regions?: string[] }) {
  const params = new URLSearchParams({ q: query.name, etat_administratif: "A", per_page: "5", minimal: "true", include: "siege" });
  if (query.departement) params.set("departement", query.departement);
  if (query.regions?.length) params.set("region", query.regions.join(","));

  return spaced(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(`${BASE_URL}?${params}`, {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(8_000),
      });
      if (response.status === 429 && attempt === 0) {
        const wait = Math.min(Number(response.headers.get("retry-after")) || 1, 5);
        await new Promise((resolve) => setTimeout(resolve, wait * 1000));
        continue;
      }
      if (!response.ok) throw new Error(`Company registry answered ${response.status}`);
      const body = (await response.json()) as { results?: ApiResult[] };
      return (body.results ?? []).map(toRegistryCompany);
    }
    throw new Error("Company registry rate limit");
  });
}
