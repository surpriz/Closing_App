"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { capsuleUploadPrefix, deletePrivateBlob, headPrivateBlob } from "@/lib/blob";
import { inBackground } from "@/lib/closing/background";
import { capsuleScopeKey, WELCOME_PAGE } from "@/lib/closing/capsules/resolve";
import { editableLinks } from "@/lib/closing/dashboard/queries";
import { CAPSULE_HOOK_MAX, CAPSULE_MAX_MS, CAPSULE_POSTER_MAX_BYTES, CAPSULE_POSTER_TYPE } from "@/lib/closing/media/limits";
import { baseMime } from "@/lib/closing/media/mime";
import { validateMedia, type MediaError } from "@/lib/closing/media/validate";
import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/session";

type CapsuleResult = { ok: true } | { error: string };

const MEDIA_ERRORS: Record<MediaError, string> = {
  type: "Ce format n'est pas pris en charge.",
  too_large: "L'enregistrement est trop lourd.",
  empty: "L'enregistrement est vide.",
  too_long: `L'enregistrement dépasse ${CAPSULE_MAX_MS / 1000} secondes.`,
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
  // WELCOME_PAGE (0) for the whole document
  pageNumber: z.number().int().min(0),
  kind: z.enum(["VIDEO", "AUDIO"]),
  pathname: z.string().min(1).max(512),
  posterPathname: z.string().min(1).max(512).nullish(),
  durationMs: z.number().int().min(1),
  hookText: z.string().max(CAPSULE_HOOK_MAX * 2),
});

/** The still is a nicety: a missing or odd one is dropped, the clip saves without it. */
async function checkedPoster(pathname: string | null | undefined, prefix: string, kind: string) {
  if (!pathname) return null;
  const blob = pathname.startsWith(prefix) ? await headPrivateBlob(pathname).catch(() => null) : null;
  const ok =
    blob && kind === "VIDEO" && baseMime(blob.contentType) === CAPSULE_POSTER_TYPE && blob.size <= CAPSULE_POSTER_MAX_BYTES;
  if (ok) return blob.pathname;
  if (blob) inBackground("capsule-poster-discard", () => deletePrivateBlob(pathname));
  return null;
}

/** Registers a clip the browser just uploaded, replacing the page's previous one for the same scope. */
export async function saveCapsule(input: z.input<typeof saveSchema>): Promise<CapsuleResult> {
  const parsed = saveSchema.safeParse(input);
  if (!parsed.success) return { error: "Enregistrement invalide." };
  const { documentId, linkId, pageNumber, kind, pathname, durationMs } = parsed.data;
  const { workspace, document } = await requireCapsuleScope({ documentId, linkId });

  const prefix = capsuleUploadPrefix(workspace.organization.id);
  if (!pathname.startsWith(prefix)) return { error: "Enregistrement invalide." };
  const poster = parsed.data.posterPathname;
  const discard = () =>
    inBackground("capsule-discard", () => deletePrivateBlob(poster?.startsWith(prefix) ? [pathname, poster] : pathname));

  // The welcome message fits any document, a web link included; a page needs a PDF that has it
  if (pageNumber !== WELCOME_PAGE && (document.kind !== "FILE" || pageNumber > (document.numPages ?? 0))) {
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
  const previous = await prisma.pageCapsule.findUnique({ where, select: { id: true, blobPathname: true, posterPathname: true } });
  const data = {
    kind,
    blobPathname: blob.pathname,
    posterPathname: await checkedPoster(poster, prefix, kind),
    contentType,
    sizeBytes: blob.size,
    durationMs,
    hookText: hookSchema.parse(parsed.data.hookText.slice(0, CAPSULE_HOOK_MAX)),
    createdById: workspace.user.id,
  };
  // A new row, not an update: its own plays, and prospects who closed the old take see this one (dismissals go by id)
  await prisma.$transaction([
    ...(previous ? [prisma.pageCapsule.delete({ where: { id: previous.id } })] : []),
    prisma.pageCapsule.create({ data: { documentId: document.id, linkId, scopeKey, pageNumber, ...data } }),
  ]);
  if (previous) {
    const stale = [previous.blobPathname, previous.posterPathname].filter((p): p is string => !!p && p !== blob.pathname);
    if (stale.length > 0) inBackground("capsule-replace", () => deletePrivateBlob(stale));
  }

  revalidateCapsule(document.id, linkId);
  return { ok: true };
}

async function requireOwnedCapsule(capsuleId: string) {
  const capsule = await prisma.pageCapsule.findUnique({
    where: { id: capsuleId },
    select: { id: true, documentId: true, linkId: true, blobPathname: true, posterPathname: true },
  });
  if (!capsule) throw new Error("Capsule introuvable");
  await requireCapsuleScope({ documentId: capsule.documentId, linkId: capsule.linkId });
  return capsule;
}

export async function deleteCapsule(capsuleId: string): Promise<CapsuleResult> {
  const capsule = await requireOwnedCapsule(capsuleId);
  await prisma.pageCapsule.delete({ where: { id: capsule.id } });
  const files = capsule.posterPathname ? [capsule.blobPathname, capsule.posterPathname] : capsule.blobPathname;
  inBackground("capsule-delete", () => deletePrivateBlob(files));
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
