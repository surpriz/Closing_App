import { prisma } from "@/lib/db";

import { fold } from "../text";
import { searchCompanies } from "./client";
import { nameFromDomain, pickCompany } from "./match";

// Registry data barely moves: a month is fine, and misses are cached too
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CompanyRecord = {
  siren: string | null;
  name: string | null;
  naf: string | null;
  headcountCode: string | null;
  departement: string | null;
  region: string | null;
  confidence: number;
};

async function cached(key: string, now: Date, resolve: () => Promise<CompanyRecord>) {
  const hit = await prisma.companyLookup.findUnique({ where: { key } });
  if (hit && now.getTime() - hit.fetchedAt.getTime() < TTL_MS) return hit;

  const record = await resolve();
  await prisma.companyLookup.upsert({
    where: { key },
    create: { key, ...record, fetchedAt: now },
    update: { ...record, fetchedAt: now },
  });
  return record;
}

async function resolveByName(name: string, departement: string | null): Promise<CompanyRecord> {
  const companies = await searchCompanies({ name, departement });
  const picked = pickCompany({ name, departement }, companies);
  const company = picked && companies.find((c) => c.siren === picked.siren);
  if (!picked || !company) {
    return { siren: null, name: null, naf: null, headcountCode: null, departement: null, region: null, confidence: 0 };
  }
  return {
    siren: company.siren,
    name: company.names[0] ?? null,
    naf: company.naf,
    headcountCode: company.headcountCode,
    departement: company.departement,
    region: company.region,
    confidence: picked.confidence,
  };
}

/** Email domain of a customer → company, guessed from the domain label. */
export function lookupDomain(domain: string, now = new Date()) {
  const name = nameFromDomain(domain);
  if (!name) return null;
  return cached(`domain:${domain.toLowerCase()}`, now, () => resolveByName(name, null));
}

/** Company named by a provider, optionally in a departement. */
export function lookupCompanyName(name: string, departement: string | null, now = new Date()) {
  const key = `name:${fold(name)}|${departement ?? ""}`;
  return cached(key, now, () => resolveByName(name, departement));
}
