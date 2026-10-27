"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";

import { INTL_LOCALE } from "@/i18n/locale";
import { getAppOrigin } from "@/lib/app-origin";
import { logAudit } from "@/lib/audit";
import { linkQuota, upgradePrompt, videoPitchQuota, type UpgradePrompt } from "@/lib/billing/workspace-plan";
import { deletePrivateBlob, headPrivateBlob, pitchUploadPrefix } from "@/lib/blob";
import { inBackground } from "@/lib/closing/background";
import { createFileDocument } from "@/lib/closing/documents/create-document";
import { createDocumentLink, followDocumentType } from "@/lib/closing/documents/create-link";
import { DOC_TYPES } from "@/lib/closing/documents/doc-types";
import { inspectWebLink } from "@/lib/closing/documents/inspect-web-link";
import { PAGE_TAGS } from "@/lib/closing/documents/page-reading";
import { processWebDocument } from "@/lib/closing/documents/process-web-document";
import { readDocumentPages } from "@/lib/closing/documents/read-pages";
import { VIDEO_SEGMENTS } from "@/lib/closing/documents/video-segments";
import { parseWebUrl } from "@/lib/closing/documents/web-link";
import { cancelOpenFollowups } from "@/lib/closing/followups/queue";
import { CAPSULE_POSTER_TYPE, PITCH_MAX_MS, PITCH_POSTER_MAX_BYTES } from "@/lib/closing/media/limits";
import { baseMime } from "@/lib/closing/media/mime";
import { validateMedia } from "@/lib/closing/media/validate";
import { prisma } from "@/lib/db";
import { requireManager, requireWorkspace } from "@/lib/session";

const createDocumentSchema = z.object({
  pathname: z.string().min(1).max(512),
  name: z.string().min(1).max(200),
  sha256: z.string().optional(),
});

/**
 * Dropping a document gives a link ready to send, without waiting for the
 * reading: the viewer copes with a document still processing. The link stays
 * a draft (out of the deals) until the seller copies or sends it.
 */
async function draftLinkFor(documentId: string, workspace: { userId: string; organizationId: string }) {
  const link = await createDocumentLink({ ...workspace, documentId, draft: true });
  if (!link) throw new Error("Document introuvable");
  return link.id;
}

// Checked before anything is created: no document is left without its link
async function linkLimitError(organizationId: string): Promise<UpgradePrompt | null> {
  const links = await linkQuota(organizationId);
  return links.allowed ? null : upgradePrompt("links", { max: links.max ?? 0 });
}

/** Asked when the recorder opens: no take recorded for a pitch the plan would refuse. */
export async function checkPitchAllowance(): Promise<UpgradePrompt | null> {
  const { organization } = await requireWorkspace();
  return pitchLimitError(organization.id);
}

/** Asked before uploading a file: no upload for a link the plan would refuse. */
export async function checkLinkAllowance(): Promise<UpgradePrompt | null> {
  const { organization } = await requireWorkspace();
  return linkLimitError(organization.id);
}

async function pitchLimitError(organizationId: string): Promise<UpgradePrompt | null> {
  const [limit, pitches] = await Promise.all([linkLimitError(organizationId), videoPitchQuota(organizationId)]);
  if (limit) return limit;
  return pitches.allowed ? null : upgradePrompt("videoPitch");
}

// Called by the browser once the PDF is in Blob storage. Same file as before: the existing document gets a new link.
export async function createDocument(input: { pathname: string; name: string; sha256?: string }) {
  const { user, organization } = await requireWorkspace();
  const { pathname, name, sha256 } = createDocumentSchema.parse(input);
  const limit = await linkLimitError(organization.id);
  if (limit) return limit;

  const { document, reused } = await createFileDocument({
    organizationId: organization.id,
    userId: user.id,
    pathname,
    name,
    sha256,
  });
  // The same file dropped again: its link still waiting to be sent, unnamed and never copied, is the one to send
  const waiting = reused
    ? await prisma.link.findFirst({
        where: {
          documentId: document.id,
          organizationId: organization.id,
          createdById: user.id,
          archivedAt: null,
          draftAt: { not: null },
          // A copied one may already sit in someone's inbox: it is theirs
          copiedAt: null,
          isOnboardingTest: false,
          shared: false,
          prospects: { none: {} },
        },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      })
    : null;
  const linkId =
    waiting?.id ?? (await draftLinkFor(document.id, { userId: user.id, organizationId: organization.id }));

  revalidatePath("/documents");
  return { id: document.id, linkId, reused, waiting: !!waiting };
}

export type CreateWebDocumentResult = { id: string; linkId: string } | { error: string } | UpgradePrompt;

// A pasted URL (Notion, Loom, Figma...). Ready at once, its text is read in the background.
export async function createWebDocument(input: { url: string }): Promise<CreateWebDocumentResult> {
  const { user, organization } = await requireWorkspace();
  const url = parseWebUrl(String(input.url ?? "").slice(0, 2048));
  if (!url) return { error: (await getTranslations("documents.actions"))("invalidLink") };
  const limit = await linkLimitError(organization.id);
  if (limit) return limit;

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
  const linkId = await draftLinkFor(document.id, { userId: user.id, organizationId: organization.id });
  after(() => processWebDocument(document.id));

  revalidatePath("/documents");
  return { id: document.id, linkId };
}

const createVideoSchema = z.object({
  videoPathname: z.string().min(1).max(512),
  audioPathname: z.string().min(1).max(512).nullish(),
  posterPathname: z.string().min(1).max(512).nullish(),
  durationMs: z.number().int().min(1),
  name: z.string().trim().max(200).optional(),
});


/** An extra file of the pitch (already checked to be under the workspace prefix) of the right kind, or null. */
async function checkedPitchFile(
  pathname: string | null | undefined,
  accepts: (blob: { contentType: string; size: number }) => boolean,
) {
  if (!pathname) return null;
  const blob = await headPrivateBlob(pathname).catch(() => null);
  if (blob && accepts({ contentType: baseMime(blob.contentType), size: blob.size })) return blob;
  if (blob) inBackground("pitch-discard", () => deletePrivateBlob(pathname));
  return null;
}

/**
 * A video pitch the browser just uploaded: the video is the document, tracked
 * as VIDEO_SEGMENTS pages. It plays at once; the transcript (mic track) fills
 * the pages in the background for the AI and the chat.
 */
export async function createVideoDocument(
  input: z.input<typeof createVideoSchema>,
): Promise<{ id: string; linkId: string } | { error: string } | UpgradePrompt> {
  const { user, organization } = await requireWorkspace();
  const [t, locale] = await Promise.all([getTranslations("documents.actions"), getLocale()]);
  const parsed = createVideoSchema.safeParse(input);
  if (!parsed.success) return { error: t("invalidRecording") };
  const { videoPathname, durationMs } = parsed.data;
  const prefix = pitchUploadPrefix(organization.id);
  // Only this workspace's own uploads, three distinct files: nothing else is ever read, kept or deleted
  const paths = [videoPathname, parsed.data.audioPathname, parsed.data.posterPathname].filter((p): p is string => !!p);
  if (paths.some((p) => !p.startsWith(prefix)) || new Set(paths).size !== paths.length) {
    return { error: t("invalidRecording") };
  }

  // Fresh uploads only: a file another document uses is never taken over
  const taken = await prisma.document.count({
    where: { OR: [{ blobPathname: { in: paths } }, { audioPathname: { in: paths } }, { posterPathname: { in: paths } }] },
  });
  if (taken > 0) return { error: t("invalidRecording") };

  const refused = await pitchLimitError(organization.id);
  if (refused) {
    inBackground("pitch-discard", () => deletePrivateBlob(paths));
    return refused;
  }

  const video = await headPrivateBlob(videoPathname).catch(() => null);
  if (!video) return { error: t("uploadFailed") };
  const contentType = baseMime(video.contentType);
  const mediaError = validateMedia({ use: "pitch", kind: "VIDEO", contentType, size: video.size, durationMs });
  if (mediaError) {
    inBackground("pitch-discard", () => deletePrivateBlob(paths));
    return {
      error:
        mediaError === "too_long"
          ? t("videoTooLong", { minutes: PITCH_MAX_MS / 60_000 })
          : mediaError === "too_large"
            ? t("videoTooLarge")
            : t("videoUnsupported"),
    };
  }

  // The mic track and the still are extras: an odd one is dropped, the video saves without it
  const [audio, poster] = await Promise.all([
    checkedPitchFile(parsed.data.audioPathname, (blob) => !validateMedia({ use: "pitch", kind: "AUDIO", ...blob, durationMs })),
    checkedPitchFile(
      parsed.data.posterPathname,
      (blob) => blob.contentType === CAPSULE_POSTER_TYPE && blob.size <= PITCH_POSTER_MAX_BYTES,
    ),
  ]);

  const document = await prisma.document.create({
    data: {
      organizationId: organization.id,
      ownerId: user.id,
      kind: "VIDEO",
      // Seller's UI language: the seller can rename it, but the prospect sees this name too
      name:
        parsed.data.name ||
        t("pitchName", {
          date: new Intl.DateTimeFormat(INTL_LOCALE[locale], { day: "numeric", month: "long" }).format(new Date()),
        }),
      blobUrl: video.url,
      blobPathname: video.pathname,
      contentType,
      sizeBytes: video.size,
      audioPathname: audio?.pathname ?? null,
      posterPathname: poster?.pathname ?? null,
      durationMs,
      numPages: VIDEO_SEGMENTS,
      status: "READY",
      pages: {
        createMany: { data: Array.from({ length: VIDEO_SEGMENTS }, (_, i) => ({ pageNumber: i + 1, tags: [] })) },
      },
    },
    select: { id: true },
  });
  const linkId = await draftLinkFor(document.id, { userId: user.id, organizationId: organization.id });
  inBackground("pitch-transcribe", () => readDocumentPages(document.id));

  revalidatePath("/documents");
  return { id: document.id, linkId };
}

/** "Nouveau lien" on a document: a fresh draft, set up on the share screen. */
export async function createQuickLink(
  documentId: string,
  { smart = false }: { smart?: boolean } = {},
): Promise<{ linkId: string } | { error: string } | UpgradePrompt> {
  const { user, organization } = await requireWorkspace();
  const limit = await linkLimitError(organization.id);
  if (limit) return limit;
  // A Smart Link is live from the start: it shows on the document and is never taken for the link to send
  const link = await createDocumentLink({ userId: user.id, organizationId: organization.id, documentId, draft: !smart, smart });
  return link ? { linkId: link.id } : { error: (await getTranslations("documents.actions"))("notFound") };
}

// Soft delete: the document and its links disappear from the app and stop opening
// for prospects; pending follow-ups are cancelled. The retention purge removes
// it for good, files included, after ARCHIVE_GRACE_DAYS.
// Every seller's links go with it, hence managers only.
export async function archiveDocument(documentId: string) {
  const { user, organization } = await requireManager();
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
    await cancelOpenFollowups(link.id, "documentDeleted");
  }
  await logAudit({
    organizationId: organization.id,
    actorUserId: user.id,
    action: "document.archived",
    targetType: "document",
    targetId: document.id,
    metadata: { links: document.links.length },
  });

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
  if (!parsed.success) return { error: (await getTranslations("documents.actions"))("invalidTags") };
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
  if (!parsed.success) return { error: (await getTranslations("documents.actions"))("descriptionTooLong") };
  await prisma.document.update({ where: { id: document.id }, data: { sellerDescription: parsed.data } });
  revalidatePath(`/documents/${document.id}`);
  return { ok: true };
}

const docTypeSchema = z.enum(DOC_TYPES);

// The AI guessed wrong: the seller's type sticks, even through a new reading
export async function setDocumentType(documentId: string, docType: string) {
  const document = await requireOwnedDocument(documentId);
  const parsed = docTypeSchema.safeParse(docType);
  if (!parsed.success) return { error: (await getTranslations("documents.actions"))("unknownType") };
  await prisma.document.update({
    where: { id: document.id },
    data: { docType: parsed.data, docTypeSource: "MANUAL" },
  });
  await followDocumentType(document.id);
  revalidatePath(`/documents/${document.id}`);
  return { ok: true };
}

const assistantNotesSchema = z
  .string()
  .trim()
  .max(4000)
  .transform((v) => v || null);

// Details the document leaves out, for the prospect assistant
export async function saveAssistantNotes(documentId: string, notes: string) {
  const document = await requireOwnedDocument(documentId);
  const parsed = assistantNotesSchema.safeParse(notes);
  if (!parsed.success) return { error: (await getTranslations("documents.actions"))("notesTooLong") };
  await prisma.document.update({ where: { id: document.id }, data: { assistantNotes: parsed.data } });
  revalidatePath(`/documents/${document.id}`);
  return { ok: true };
}

export async function rereadDocument(documentId: string) {
  const document = await requireOwnedDocument(documentId);
  const t = await getTranslations("documents.actions");
  let outcome;
  if (document.kind === "URL") {
    // The page may have changed since: fetch it again, then the AI reads it
    outcome = await processWebDocument(document.id);
    if (outcome === "no_text") return { error: t("noText") };
    if (outcome === "unreachable") {
      return { error: t("unreachable") };
    }
  } else {
    await prisma.document.update({ where: { id: document.id }, data: { aiProcessedAt: null, aiAttempts: 0 } });
    outcome = await readDocumentPages(document.id);
  }
  revalidatePath(`/documents/${document.id}`);
  if (outcome === "no_ai") return { error: t("noAi") };
  if (outcome === "failed") return { error: t("readFailed") };
  return { ok: true };
}
