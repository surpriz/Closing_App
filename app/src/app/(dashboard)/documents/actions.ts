"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";

import { getAppOrigin } from "@/lib/app-origin";
import { documentUploadPrefix, headPrivateBlob } from "@/lib/blob";
import { inspectWebLink } from "@/lib/closing/documents/inspect-web-link";
import { PAGE_TAGS } from "@/lib/closing/documents/page-reading";
import { processDocument } from "@/lib/closing/documents/process-document";
import { readDocumentPages } from "@/lib/closing/documents/read-pages";
import { parseWebUrl } from "@/lib/closing/documents/web-link";
import { cancelOpenFollowups } from "@/lib/closing/followups/queue";
import { prisma } from "@/lib/db";
import { randomSlug } from "@/lib/ids";
import { requireWorkspace } from "@/lib/session";

const createDocumentSchema = z.object({
  pathname: z.string().min(1).max(512),
  name: z.string().min(1).max(200),
});

// Called by the browser once the PDF is in Blob storage
export async function createDocument(input: { pathname: string; name: string }) {
  const { user, organization } = await requireWorkspace();
  const { pathname, name } = createDocumentSchema.parse(input);

  if (!pathname.startsWith(documentUploadPrefix(organization.id))) {
    throw new Error("Invalid document path");
  }

  // Trust Blob metadata, not what the browser claims
  const blob = await headPrivateBlob(pathname);
  if (blob.contentType !== "application/pdf") {
    throw new Error("Only PDF files are supported");
  }

  const document = await prisma.document.create({
    data: {
      organizationId: organization.id,
      ownerId: user.id,
      name: name.replace(/\.pdf$/i, ""),
      blobUrl: blob.url,
      blobPathname: blob.pathname,
      contentType: blob.contentType,
      sizeBytes: blob.size,
      status: "PROCESSING",
    },
    select: { id: true },
  });

  after(() => processDocument(document.id));

  revalidatePath("/documents");
  return { id: document.id };
}

export type CreateWebDocumentResult = { id: string } | { error: string };

// A pasted URL (Notion, Loom, Figma...). Nothing to extract: ready at once.
export async function createWebDocument(input: { url: string }): Promise<CreateWebDocumentResult> {
  const { user, organization } = await requireWorkspace();
  const url = parseWebUrl(String(input.url ?? "").slice(0, 2048));
  if (!url) return { error: "Ce lien n'est pas valide." };

  const { name, embedUrl } = await inspectWebLink(url, await getAppOrigin());
  const document = await prisma.document.create({
    data: {
      organizationId: organization.id,
      ownerId: user.id,
      kind: "URL",
      name,
      externalUrl: url.toString(),
      embedUrl,
      contentType: "text/html",
      status: "READY",
    },
    select: { id: true },
  });

  revalidatePath("/documents");
  return { id: document.id };
}

export type CreateLinkState = { error?: string; url?: string } | null;

const createLinkSchema = z.object({
  name: z.string().trim().max(120).optional(),
  prospectEmail: z.union([z.literal(""), z.email().max(254)]),
  prospectName: z.string().trim().max(120).optional(),
  prospectCompany: z.string().trim().max(120).optional(),
  requireEmail: z.enum(["true", "false"]),
});

export async function createLink(
  documentId: string,
  _prev: CreateLinkState,
  formData: FormData,
): Promise<CreateLinkState> {
  const { user, organization } = await requireWorkspace();

  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: organization.id },
    select: { id: true },
  });
  if (!document) return { error: "Document introuvable." };

  const parsed = createLinkSchema.safeParse({
    name: formData.get("name") ?? undefined,
    prospectEmail: String(formData.get("prospectEmail") ?? "").trim().toLowerCase(),
    prospectName: formData.get("prospectName") ?? undefined,
    prospectCompany: formData.get("prospectCompany") ?? undefined,
    requireEmail: formData.get("requireEmail") ?? "true",
  });
  if (!parsed.success) return { error: "Vérifiez l'email du prospect." };

  const { name, prospectEmail, prospectName, prospectCompany, requireEmail } = parsed.data;

  const link = await prisma.link.create({
    data: {
      slug: randomSlug(12),
      documentId: document.id,
      organizationId: organization.id,
      createdById: user.id,
      name: name || prospectCompany || prospectEmail || null,
      requireEmail: requireEmail === "true",
      sentAt: new Date(),
      prospects: prospectEmail
        ? {
            create: {
              email: prospectEmail,
              name: prospectName || null,
              company: prospectCompany || null,
            },
          }
        : undefined,
    },
    select: { slug: true },
  });

  revalidatePath(`/documents/${document.id}`);
  return { url: `/v/${link.slug}` };
}

// Soft delete: the document and its links disappear from the app and stop opening
// for prospects; pending follow-ups are cancelled. Views stay in the database.
export async function archiveDocument(documentId: string) {
  const { organization } = await requireWorkspace();
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: organization.id, archivedAt: null },
    select: { id: true, links: { where: { archivedAt: null }, select: { id: true } } },
  });
  if (!document) redirect("/documents");

  const now = new Date();
  await prisma.$transaction([
    prisma.link.updateMany({ where: { documentId: document.id, archivedAt: null }, data: { archivedAt: now } }),
    prisma.document.update({ where: { id: document.id }, data: { archivedAt: now } }),
  ]);
  for (const link of document.links) {
    await cancelOpenFollowups(link.id, "Document supprimé");
  }

  revalidatePath("/documents");
  revalidatePath("/dashboard");
  redirect("/documents");
}

async function requireOwnedDocument(documentId: string) {
  const { organization } = await requireWorkspace();
  const document = await prisma.document.findFirst({
    where: { id: documentId, organizationId: organization.id, archivedAt: null },
    select: { id: true, kind: true },
  });
  if (!document) throw new Error("Document introuvable");
  return document;
}

const pageTagsSchema = z.array(z.enum(PAGE_TAGS)).max(PAGE_TAGS.length);

// A tag fixed by the seller is never overwritten by the keyword guess or the AI
export async function setPageTags(documentId: string, pageNumber: number, tags: string[]) {
  const document = await requireOwnedDocument(documentId);
  const parsed = pageTagsSchema.safeParse([...new Set(tags)]);
  if (!parsed.success) return { error: "Étiquettes invalides." };
  await prisma.documentPage.update({
    where: { documentId_pageNumber: { documentId: document.id, pageNumber } },
    data: { tags: parsed.data, tagSource: "MANUAL" },
  });
  revalidatePath(`/documents/${document.id}`);
  return { ok: true };
}

const sellerDescriptionSchema = z
  .string()
  .trim()
  .max(1500)
  .transform((v) => v || null);

// Web links have no text Clozer can read: the seller says what the page is about
export async function saveSellerDescription(documentId: string, description: string) {
  const document = await requireOwnedDocument(documentId);
  const parsed = sellerDescriptionSchema.safeParse(description);
  if (!parsed.success) return { error: "Description trop longue." };
  await prisma.document.update({ where: { id: document.id }, data: { sellerDescription: parsed.data } });
  revalidatePath(`/documents/${document.id}`);
  return { ok: true };
}

export async function rereadDocument(documentId: string) {
  const document = await requireOwnedDocument(documentId);
  if (document.kind !== "FILE") return { error: "Rien à relire pour un lien web." };
  await prisma.document.update({ where: { id: document.id }, data: { aiProcessedAt: null, aiAttempts: 0 } });
  const outcome = await readDocumentPages(document.id);
  revalidatePath(`/documents/${document.id}`);
  if (outcome === "no_ai") return { error: "Aucune IA n'est configurée." };
  if (outcome === "failed") return { error: "La lecture a échoué, réessayez dans un moment." };
  return { ok: true };
}
