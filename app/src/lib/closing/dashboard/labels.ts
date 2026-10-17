import { humanizeName, linkTitle } from "../documents/link-title";

/** The contact a deal is named after: the first one added to the link. */
export const firstProspect = {
  orderBy: { createdAt: "asc" },
  take: 1,
  select: { name: true, email: true, company: true },
} as const;

/** What `dealLabel` reads, ready to spread into a Prisma link select. */
export const linkLabelSelect = {
  id: true,
  name: true,
  slug: true,
  prospects: firstProspect,
  document: { select: { name: true, displayTitle: true, docType: true } },
} as const;

export type LabelledLink = {
  name: string | null;
  slug: string;
  document?: { name: string; displayTitle?: string | null; docType?: string | null } | null;
  prospects: { company: string | null; name: string | null; email: string | null }[];
};

const fold = (value: string) => value.trim().toLowerCase();

/** A link name the seller typed: the title Clozer gave the link at creation does not count. */
export function customLinkName(link: Pick<LabelledLink, "name" | "document" | "prospects">): string | null {
  const name = link.name?.trim();
  if (!name) return null;
  const document = link.document;
  if (!document) return name;
  const company = link.prospects[0]?.company;
  const generated = [
    document.name,
    document.displayTitle,
    humanizeName(document.name),
    linkTitle(document),
    linkTitle({ ...document, company }),
  ].filter((value): value is string => Boolean(value));
  // "Devis – Acme": the company suffix linkTitle adds for a recipient who may be gone since
  const base = name.split(" – ")[0];
  return generated.some((value) => fold(value) === fold(name) || fold(value) === fold(base)) ? null : name;
}

/**
 * How a deal is named everywhere: the person first, never the document.
 * `noRecipient` is the translated "today.page.noRecipient", for a link nobody is named on yet.
 */
export function dealLabel(link: LabelledLink, noRecipient = "Sans destinataire"): string {
  const prospect = link.prospects[0];
  return (
    prospect?.company?.trim() ||
    prospect?.name?.trim() ||
    prospect?.email?.trim() ||
    customLinkName(link) ||
    // Nobody named yet: the document shows on the line below
    noRecipient
  );
}

/** The document as a second line: null when the label already says it. */
export function dealDocumentMeta(link: LabelledLink): string | null {
  const name = link.document?.name;
  if (!name) return null;
  return fold(name) === fold(dealLabel(link, "")) ? null : name;
}
