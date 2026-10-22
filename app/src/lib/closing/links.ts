import { cookies } from "next/headers";

import { BILLING_SELECT } from "@/lib/billing/workspace-plan";
import { prisma } from "@/lib/db";

import { isLinkExpired, viewerDeadline } from "./expiry";
import { companyFromEmail } from "./prospects/from-recipient";
import { readGateCookie, signGateCookie } from "./tracking/gate-cookie";
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
          contentType: true,
          posterPathname: true,
          durationMs: true,
          contentSha256: true,
          language: true,
          archivedAt: true,
        },
      },
      organization: { select: { suspendedAt: true, ...BILLING_SELECT } },
    },
  });
}

export type ViewerLink = NonNullable<Awaited<ReturnType<typeof findViewerLink>>>;

export type ViewerLinkState = "open" | "expired" | "archived";

/**
 * Link as seen by a prospect, dead ones included. Null when unknown or the
 * workspace is suspended. Only the locked pages and the revival request and
 * signal read a link that is not open.
 */
export async function resolveViewerLink(slug: string, now = new Date()) {
  if (!SLUG_PATTERN.test(slug)) return null;
  const link = await findViewerLink(slug);
  // A suspended workspace's links read as unknown: no page, no tracking
  if (!link || link.organization.suspendedAt) return null;
  // Withdrawn wins over expired: more time would not open it
  if (link.archivedAt || link.document.archivedAt) return { link, state: "archived" as ViewerLinkState };
  // A signed quote stays readable after its deadline: the receipt link keeps working
  const expired = isLinkExpired({ expiresAt: viewerDeadline(link) }, now);
  return { link, state: (expired ? "expired" : "open") as ViewerLinkState };
}

// Link as seen by a prospect. Null when unknown, archived or expired.
export async function getLinkForViewer(slug: string) {
  const resolved = await resolveViewerLink(slug);
  return resolved?.state === "open" ? resolved.link : null;
}

// Same key as the forward tokens: it never rotates, so gate cookies stay valid
function gateSecret() {
  const secret = process.env.ENCRYPTION_KEY;
  if (!secret || secret.length < 32) throw new Error("ENCRYPTION_KEY must be at least 32 characters");
  return secret;
}

export async function getViewerAccess(link: { id: string; requireEmail: boolean }) {
  // An unsigned or edited cookie counts as none: the reader types their email again
  const email = readGateCookie(link.id, (await cookies()).get(emailCookieName(link.id))?.value, gateSecret());
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

  (await cookies()).set(emailCookieName(link.id), signGateCookie(link.id, email, gateSecret()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: EMAIL_COOKIE_MAX_AGE,
    path: "/",
  });
}

/**
 * The one person the seller sent this link to, when there is exactly one:
 * the gate can greet them and open in a click. Several contacts, or none,
 * and the reader types their email as before.
 */
export async function knownRecipient(linkId: string) {
  const prospects = await prisma.prospect.findMany({
    where: { linkId, origin: "SELLER", unsubscribedAt: null },
    select: { email: true, name: true },
    take: 2,
  });
  return prospects.length === 1 ? prospects[0] : null;
}
