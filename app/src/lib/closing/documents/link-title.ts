import { DOC_TYPE_LABELS, type DocType } from "./doc-types";

// "devis_acme-v2" → "Devis acme v2"
export function humanizeName(name: string) {
  const clean = name.replace(/\.pdf$/i, "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// What the prospect reads in the email: "Devis – Acme Group". Pure.
export function linkTitle(input: { name: string; docType?: string | null; company?: string | null }) {
  const label = input.docType && input.docType !== "OTHER" ? DOC_TYPE_LABELS[input.docType as DocType] : undefined;
  const base = label ?? (humanizeName(input.name) || "Document");
  const company = input.company?.trim();
  if (!company || base.toLowerCase().includes(company.toLowerCase())) return base;
  return `${base} – ${company}`;
}
