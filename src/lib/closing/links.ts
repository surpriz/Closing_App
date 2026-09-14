import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

import { emailCookieName } from "./tracking/visitor";

const SLUG_PATTERN = /^[A-Za-z0-9]{6,32}$/;

// Link as seen by a prospect. Null when unknown, archived or expired.
export async function getLinkForViewer(slug: string) {
  if (!SLUG_PATTERN.test(slug)) return null;

  const link = await prisma.link.findUnique({
    where: { slug },
    include: {
      document: {
        select: {
          id: true,
          name: true,
          status: true,
          numPages: true,
          blobPathname: true,
          archivedAt: true,
        },
      },
    },
  });

  if (!link || link.archivedAt || link.document.archivedAt) return null;
  if (link.expiresAt && link.expiresAt < new Date()) return null;
  return link;
}

export async function getViewerAccess(link: { id: string; requireEmail: boolean }) {
  const email = (await cookies()).get(emailCookieName(link.id))?.value ?? null;
  return { allowed: !link.requireEmail || !!email, email };
}
