import { deletePrivateBlob } from "@/lib/blob";
import { prisma } from "@/lib/db";

// Signed validations are proof of the agreement: they outlive the tracking data
// and are purged on their own clock (see retention/purge.ts)
export const KEPT_ACTION_TYPES = ["VALIDATE_SIGN"] as const;

const BLOB_BATCH = 100;

// Files go first: if the store fails, the rows stay and the next run tries again
export async function deleteBlobs(pathnames: (string | null | undefined)[]) {
  const paths = [...new Set(pathnames.filter((p): p is string => !!p))];
  for (let i = 0; i < paths.length; i += BLOB_BATCH) {
    await deletePrivateBlob(paths.slice(i, i + BLOB_BATCH));
  }
  return paths.length;
}

// Everything a link knows about its readers. The link itself (deal status, amount)
// stays, with the prospect-identifying fields cleared.
export async function eraseLinkTracking(linkId: string) {
  const voice = await prisma.voiceComment.findMany({ where: { linkId }, select: { blobPathname: true } });
  await deleteBlobs(voice.map((v) => v.blobPathname));

  await prisma.$transaction([
    prisma.voiceComment.deleteMany({ where: { linkId } }),
    prisma.chatMessage.deleteMany({ where: { linkId } }),
    prisma.capsulePlay.deleteMany({ where: { linkId } }),
    prisma.pageView.deleteMany({ where: { linkId } }),
    prisma.prospectAction.deleteMany({ where: { linkId, type: { notIn: [...KEPT_ACTION_TYPES] } } }),
    prisma.documentView.deleteMany({ where: { linkId } }),
    prisma.followup.deleteMany({ where: { linkId } }),
    prisma.prospect.deleteMany({ where: { linkId } }),
    prisma.sellerAlert.deleteMany({ where: { linkId } }),
    prisma.sellerActivity.deleteMany({ where: { linkId } }),
    prisma.dealInsight.deleteMany({ where: { linkId } }),
    prisma.engagementScore.deleteMany({ where: { linkId } }),
    prisma.link.update({
      where: { id: linkId },
      data: { decisionMakerName: null, decisionMakerRole: null, sellerNotes: null, brainDirtyAt: null },
    }),
  ]);
}

// Hard delete: the database cascades take the links and their tracking,
// the files are removed by hand since the store knows nothing about the rows
export async function deleteDocumentForever(documentId: string) {
  const document = await prisma.document.findUnique({
    where: { id: documentId },
    select: {
      blobPathname: true,
      capsules: { select: { blobPathname: true } },
      links: { select: { voiceComments: { select: { blobPathname: true } } } },
    },
  });
  if (!document) return false;

  await deleteBlobs([
    document.blobPathname,
    ...document.capsules.map((c) => c.blobPathname),
    ...document.links.flatMap((l) => l.voiceComments.map((v) => v.blobPathname)),
  ]);
  await prisma.document.delete({ where: { id: documentId } });
  return true;
}
