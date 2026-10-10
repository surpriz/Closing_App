import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

import { isLinkExpired } from "./expiry";
import { companyFromEmail } from "./prospects/from-recipient";
import { EMAIL_COOKIE_MAX_AGE, emailCookieName } from "./tracking/visitor";

const SLUG_PATTERN = /^[A-Za-z0-9]{6,32}$/;

async function findViewerLink(slug: string) {
  return prisma.link.findUnique({
    where: { slug },
    include: {
      document: {
        select: {
          id: true,
          name: true,
          kind: true,
          status: true,
          docType: true,
          externalUrl: true,
          embedUrl: true,
          numPages: true,
          blobPathname: true,
          archivedAt: true,
        },
      },
    },
  });
}

export type ViewerLink = NonNullable<Awaited<ReturnType<typeof findViewerLink>>>;

/**
 * Link as seen by a prospect, expired ones included. Null when unknown or
 * archived. Only the locked page and the extension request read expired links.
 */
export async function resolveViewerLink(slug: string, now = new Date()) {
  if (!SLUG_PATTERN.test(slug)) return null;
  const link = await findViewerLink(slug);
  if (!link || link.archivedAt || link.document.archivedAt) return null;
  return { link, expired: isLinkExpired(link, now) };
}

// Link as seen by a prospect. Null when unknown, archived or expired.
export async function getLinkForViewer(slug: string) {
  const resolved = await resolveViewerLink(slug);
  return resolved && !resolved.expired ? resolved.link : null;
}

export async function getViewerAccess(link: { id: string; requireEmail: boolean }) {
  const email = (await cookies()).get(emailCookieName(link.id))?.value ?? null;
  return { allowed: !link.requireEmail || !!email, email };
}

/** The reader typed their email: remember them on this link and in this browser. */
export async function identifyProspect(link: { id: string }, email: string, name?: string) {
  await prisma.prospect.upsert({
    where: { linkId_email: { linkId: link.id, email } },
    // Someone the seller did not add: the proposal was passed on
    create: { linkId: link.id, email, name, origin: "EMAIL_GATE", company: companyFromEmail(email) },
    update: name ? { name } : {},
  });

  (await cookies()).set(emailCookieName(link.id), email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: EMAIL_COOKIE_MAX_AGE,
    path: "/",
  });
}
