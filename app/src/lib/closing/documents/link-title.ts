import { DOC_TYPE_LABELS, type DocType } from "./doc-types";

// "devis_acme-v2 (1)" → "Devis acme v2"
export function humanizeName(name: string) {
  const clean = name
    .replace(/\.pdf$/i, "")
    .replace(/\s*\(\d+\)$/, "") // "(1)" added by the OS to downloaded copies
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

// The AI's title, trimmed to something that fits a link. Null when unusable.
export function cleanDisplayTitle(raw: string | null | undefined) {
  const title = raw?.replace(/["«»“”]/g, "").replace(/\s+/g, " ").replace(/[\s.:;,]+$/, "").trim();
  if (!title || title.length < 3) return null;
  return title.length > 70 ? `${title.slice(0, 69).trimEnd()}…` : title;
}

// What the prospect reads in the email: "Devis rénovation cuisine – Acme Group". Pure.
// Best first: the AI's title, then the kind of document, then the file name.
export function linkTitle(input: {
  name: string;
  displayTitle?: string | null;
  docType?: string | null;
  company?: string | null;
}) {
  const label = input.docType && input.docType !== "OTHER" ? DOC_TYPE_LABELS[input.docType as DocType] : undefined;
  const base = input.displayTitle || label || humanizeName(input.name) || "Document";
  const company = input.company?.trim();
  if (!company || base.toLowerCase().includes(company.toLowerCase())) return base;
  return `${base} – ${company}`;
}
