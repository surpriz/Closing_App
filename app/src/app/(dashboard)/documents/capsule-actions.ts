"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { capsuleUploadPrefix, deletePrivateBlob, headPrivateBlob } from "@/lib/blob";
import { inBackground } from "@/lib/closing/background";
import { capsuleScopeKey } from "@/lib/closing/capsules/resolve";
import { editableLinks } from "@/lib/closing/dashboard/queries";
import { CAPSULE_HOOK_MAX } from "@/lib/closing/media/limits";
import { baseMime } from "@/lib/closing/media/mime";
import { validateMedia, type MediaError } from "@/lib/closing/media/validate";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

type CapsuleResult = { ok: true } | { error: string };

const MEDIA_ERRORS: Record<MediaError, string> = {
  type: "Ce format n'est pas pris en charge.",
  too_large: "L'enregistrement est trop lourd.",
  empty: "L'enregistrement est vide.",
  too_long: "L'enregistrement dépasse 30 secondes.",
};

const hookSchema = z
  .string()
  .trim()
  .max(CAPSULE_HOOK_MAX)
  .transform((v) => v || null);

/**
 * Who may change the capsules of a page: anyone in the workspace for the
 * document's default, only the link's seller or a manager for one link.
 */
async function requireCapsuleScope(input: { documentId: string; linkId: string | null }) {
  const workspace = await requireWorkspace();
  const document = await prisma.document.findFirst({
    where: { id: input.documentId, organizationId: workspace.organization.id, archivedAt: null },
    select: { id: true, kind: true, numPages: true },
  });
  if (!document) throw new Error("Document introuvable");
  if (input.linkId) {
    const link = await prisma.link.findFirst({
      where: { id: input.linkId, documentId: document.id, organizationId: workspace.organization.id, ...editableLinks(workspace) },
      select: { id: true },
    });
    if (!link) throw new Error("Lien introuvable");
  }
  return { workspace, document };
}

function revalidateCapsule(documentId: string, linkId: string | null) {
  revalidatePath(`/documents/${documentId}`);
  if (linkId) revalidatePath(`/links/${linkId}`);
}

const saveSchema = z.object({
  documentId: z.string().min(1).max(64),
  linkId: z.string().min(1).max(64).nullable(),
  pageNumber: z.number().int().min(1),
  kind: z.enum(["VIDEO", "AUDIO"]),
  pathname: z.string().min(1).max(512),
  durationMs: z.number().int().min(1),
  hookText: z.string().max(CAPSULE_HOOK_MAX * 2),
});

/** Registers a clip the browser just uploaded, replacing the page's previous one for the same scope. */
export async function saveCapsule(input: z.input<typeof saveSchema>): Promise<CapsuleResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: "Enregistrement invalide." };
  const { documentId, linkId, pageNumber, kind, pathname, durationMs } = parsed.data;
  const { workspace, document } = await requireCapsuleScope({ documentId, linkId });

  if (!pathname.startsWith(capsuleUploadPrefix(workspace.organization.id))) return { error: "Enregistrement invalide." };
  const discard = () => inBackground("capsule-discard", () => deletePrivateBlob(pathname));

  if (document.kind !== "FILE" || pageNumber > (document.numPages ?? 0)) {
    discard();
    return { error: "Cette page n'existe pas." };
  }

  // Type and size from the store, not from the browser
  const blob = await headPrivateBlob(pathname).catch(() => null);
  if (!blob) return { error: "L'envoi n'a pas abouti, réessayez." };
  const contentType = baseMime(blob.contentType);
  const mediaError = validateMedia({ use: "capsule", kind, contentType, size: blob.size, durationMs });
  if (mediaError) {
    discard();
    return { error: MEDIA_ERRORS[mediaError] };
  }

  const scopeKey = capsuleScopeKey(linkId);
  const where = { documentId_pageNumber_scopeKey: { documentId: document.id, pageNumber, scopeKey } };
  const previous = await prisma.pageCapsule.findUnique({ where, select: { blobPathname: true } });
  const data = {
    kind,
    blobPathname: blob.pathname,
    contentType,
    sizeBytes: blob.size,
    durationMs,
    hookText: hookSchema.parse(parsed.data.hookText.slice(0, CAPSULE_HOOK_MAX)),
    createdById: workspace.user.id,
  };
  await prisma.pageCapsule.upsert({
    where,
    create: { documentId: document.id, linkId, scopeKey, pageNumber, ...data },
    // A new recording counts its own plays
    update: { ...data, plays: { deleteMany: {} } },
  });
  if (previous && previous.blobPathname !== blob.pathname) {
    inBackground("capsule-replace", () => deletePrivateBlob(previous.blobPathname));
  }

  revalidateCapsule(document.id, linkId);
  return { ok: true };
}

async function requireOwnedCapsule(capsuleId: string) {
  const capsule = await prisma.pageCapsule.findUnique({
    where: { id: capsuleId },
    select: { id: true, documentId: true, linkId: true, blobPathname: true },
  });
  if (!capsule) throw new Error("Capsule introuvable");
  await requireCapsuleScope({ documentId: capsule.documentId, linkId: capsule.linkId });
  return capsule;
}

export async function deleteCapsule(capsuleId: string): Promise<CapsuleResult> {
  const capsule = await requireOwnedCapsule(capsuleId);
  await prisma.pageCapsule.delete({ where: { id: capsule.id } });
  inBackground("capsule-delete", () => deletePrivateBlob(capsule.blobPathname));
  revalidateCapsule(capsule.documentId, capsule.linkId);
  return { ok: true };
}

export async function updateCapsuleHook(capsuleId: string, hookText: string): Promise<CapsuleResult> {
  const capsule = await requireOwnedCapsule(capsuleId);
  const parsed = hookSchema.safeParse(hookText);
  if (!parsed.success) return { error: `${CAPSULE_HOOK_MAX} caractères au plus.` };
  await prisma.pageCapsule.update({ where: { id: capsule.id }, data: { hookText: parsed.data } });
  revalidateCapsule(capsule.documentId, capsule.linkId);
  return { ok: true };
}
