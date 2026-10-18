import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import type { ViewerCapsule } from "@/components/viewer/capsule-bubble";
import type { ChatWidgetData } from "@/components/viewer/chat-widget";
import { EmailGate } from "@/components/viewer/email-gate";
import { ExpiryGate } from "@/components/viewer/expiry-gate";
import type { ForwardOptions } from "@/components/viewer/forward-dialog";
import type { ViewerTranslation } from "@/components/viewer/use-translation";
import { ForwardHandoff } from "@/components/viewer/forward-handoff";
import { LinkExpired } from "@/components/viewer/link-expired";
import { PdfViewer } from "@/components/viewer/pdf-viewer";
import { SmartLinkHandoff } from "@/components/viewer/smart-link-handoff";
import { VideoViewer } from "@/components/viewer/video-viewer";
import { WebViewer } from "@/components/viewer/web-viewer";
import type { DocumentKind } from "@/generated/prisma/enums";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { bookingUrlForLink } from "@/lib/closing/booking/link-booking";
import { buildBookingTarget } from "@/lib/closing/booking/url";
import {
  capsulesVisibleOnLink,
  resolveCapsules,
  WELCOME_PAGE,
} from "@/lib/closing/capsules/resolve";
import { suggestQuestions, toUIMessages } from "@/lib/closing/chat/messages";
import { loadChatSetup } from "@/lib/closing/chat/queries";
import {
  extensionRequestKey,
  showsCountdown,
  viewerDeadline,
} from "@/lib/closing/expiry";
import type { SupportedLocale } from "@/lib/closing/constants";
import { canForward } from "@/lib/closing/forward/rules";
import {
  chosenLocale,
  getViewerLabels,
  pickLocale,
  VIEWER_LOCALE_COOKIE,
  type ViewerLabels,
} from "@/lib/closing/i18n/viewer";
import {
  getViewerAccess,
  knownRecipient,
  resolveViewerLink,
  type ViewerLink,
} from "@/lib/closing/links";
import { maskEmail } from "@/lib/closing/prospects/mask-email";
import { firstNameOf } from "@/lib/closing/share/compose";
import { viewerSenderName } from "@/lib/closing/sender-name";
import { parseSmartParams } from "@/lib/closing/shared/smart-params";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { deeplConfig } from "@/lib/closing/translation/deepl";
import { guessLanguage, translationTarget } from "@/lib/closing/translation/translation";
import { prisma } from "@/lib/db";
import { isWorkspaceMember } from "@/lib/session";

import {
  requestLinkExtension,
  unlockAsKnown,
  unlockWithEmail,
} from "./actions";

export async function generateMetadata({
  params,
}: PageProps<"/v/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  // An expired link keeps its title: the locked page still says what it was
  const resolved = await resolveViewerLink(slug);
  return {
    title: resolved?.link.document.name ?? "Document",
    robots: { index: false, follow: false },
  };
}

export default async function ViewerPage({
  params,
  searchParams,
}: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  // "Ce n'est pas moi" after a contact change: the plain gate
  const plainGate = query.email === "1";
  const resolved = await resolveViewerLink(slug);
  if (!resolved) notFound();
  const { link, expired } = resolved;

  const requestHeaders = await headers();
  const browserLocale = pickLocale(requestHeaders.get("accept-language"));
  // The language picked in the viewer's menu wins over the browser's
  const chosen = chosenLocale((await cookies()).get(VIEWER_LOCALE_COOKIE)?.value);
  const locale = chosen ?? browserLocale;
  const labels = getViewerLabels(locale);
  const [access, settings, isSeller, creator] = await Promise.all([
    getViewerAccess(link),
    prisma.workspaceSettings.findUnique({
      where: { organizationId: link.organizationId },
      select: { senderName: true },
    }),
    isWorkspaceMember(link.organizationId),
    prisma.link.findUnique({
      where: { id: link.id },
      select: {
        createdBy: { select: { name: true, email: true } },
        organization: { select: { name: true } },
      },
    }),
  ]);
  // The prospect should always know who is asking for their email
  const senderName = viewerSenderName({
    senderName: settings?.senderName,
    createdBy: creator?.createdBy,
    organizationName: creator?.organization.name,
  });
  const countdown = showsCountdown(link.document.docType);
  const deadline = viewerDeadline(link);

  const locked = (
    <LinkExpired
      action={requestLinkExtension.bind(null, slug)}
      documentName={link.document.name}
      senderName={senderName}
      labels={labels}
      quote={countdown}
      email={
        access.email ? "known" : link.requireEmail ? "required" : "optional"
      }
      alreadyRequested={
        expired && (await alreadyRequestedExtension(link, access.email))
      }
    />
  );

  // Before the email gate: there is nothing to unlock any more, only more time to ask for
  if (expired) {
    return (
      <>
        {isSeller && (
          <SellerNotice>
            Ce lien a expiré pour le prospect : voici ce qu&apos;il voit.
          </SellerNotice>
        )}
        {locked}
      </>
    );
  }

  // A shared link is a door: once the reader is known, they read on their own link
  if (link.shared && access.email && !isSeller)
    redirect(`/api/v/${slug}/reader`);

  // A Smart Link from a cold email: the tool said who it was sent to, no form
  const smart = link.shared && !isSeller ? parseSmartParams(query) : null;
  if (smart)
    return (
      <SmartLinkHandoff slug={slug} reader={smart} label={labels.loading} />
    );

  // From a forward email: the token names the recipient, no form. Done in the browser, never on this GET
  const forwardToken = typeof query.f === "string" && !link.shared && !isSeller ? query.f : null;
  if (forwardToken) {
    if (access.email) redirect(`/v/${slug}`);
    return <ForwardHandoff slug={slug} token={forwardToken} label={labels.loading} />;
  }

  if (!access.allowed) {
    const recipient = plainGate ? null : await knownRecipient(link.id);
    return (
      <EmailGate
        action={unlockWithEmail.bind(null, slug)}
        known={
          recipient && {
            firstName: firstNameOf(recipient.name),
            maskedEmail: maskEmail(recipient.email),
            unlock: unlockAsKnown.bind(null, slug),
          }
        }
        documentName={link.document.name}
        senderName={senderName}
        labels={labels}
      />
    );
  }

  if (link.document.status === "FAILED") {
    return (
      <main className="flex flex-1 items-center justify-center bg-background px-4">
        <p
          role="status"
          className="max-w-sm text-center text-body text-pretty text-muted-foreground"
        >
          {labels.unavailable}
        </p>
      </main>
    );
  }

  // Links made from the mail extension can be opened while the PDF is still being read
  if (link.document.status !== "READY") {
    return (
      <main className="flex flex-1 items-center justify-center bg-background px-4">
        <AutoRefresh intervalMs={4000} />
        <p
          role="status"
          className="flex max-w-sm items-center gap-3 text-body text-muted-foreground"
        >
          <Loader2
            className="size-4 shrink-0 motion-safe:animate-spin"
            aria-hidden
          />
          {labels.processing}
        </p>
      </main>
    );
  }

  const chat = await loadChatWidget(link, labels);
  // "Valider & signer" and the booking page start from the name we already know
  const [signerName, bookingUrl] = await Promise.all([
    (link.ctaEnabled || link.bookingEnabled) && access.email
      ? prisma.prospect
          .findUnique({
            where: { linkId_email: { linkId: link.id, email: access.email } },
            select: { name: true },
          })
          .then((prospect) => prospect?.name ?? null)
      : null,
    link.bookingEnabled ? bookingUrlForLink(link) : null,
  ]);
  const booking = bookingUrl
    ? buildBookingTarget(
        bookingUrl,
        { name: signerName, email: access.email },
        requestHeaders.get("host") ?? "",
      )
    : null;

  // "Transférer": any reader but the seller, on a link that is one deal
  const forward: ForwardOptions | null =
    !isSeller && canForward(link)
      ? { senderName: senderName ?? labels.chatSenderFallback, needsEmail: !access.email }
      : null;

  const sellerNotice = isSeller && (
    <SellerNotice>
      Vous êtes connecté à Clozer : cette lecture ne compte pas. Testez dans un
      autre navigateur.
    </SellerNotice>
  );

  // Ticks down in the page and swaps to the locked screen at zero
  const withExpiry = (viewer: React.ReactNode) =>
    deadline ? (
      <ExpiryGate
        expiresAt={deadline.toISOString()}
        serverNow={new Date().toISOString()}
        locked={locked}
      >
        {viewer}
      </ExpiryGate>
    ) : (
      viewer
    );

  if (link.document.kind === "VIDEO") {
    const src = `/api/v/${slug}/file`;
    return (
      <>
        {sellerNotice}
        {withExpiry(
          <VideoViewer
            slug={slug}
            documentName={link.document.name}
            senderName={senderName}
            src={src}
            poster={link.document.posterPathname ? `${src}?poster` : null}
            durationMs={link.document.durationMs}
            labels={labels}
            quote={link.ctaEnabled}
            booking={booking}
            forward={forward}
            dealStatus={link.dealStatus}
            locale={locale}
            chat={chat}
            countdown={!!deadline && countdown}
          />,
        )}
      </>
    );
  }

  const capsules = await loadCapsules(slug, link);
  const translation = await loadTranslation(link, { chosen, browserLocale });

  if (link.document.kind === "URL" && link.document.externalUrl) {
    // Loaded apart, and only when needed: an article weighs far more than the rest of the link
    const reader = link.document.embedUrl
      ? null
      : await prisma.document.findUnique({
          where: { id: link.document.id },
          select: { readerHtml: true },
        });
    return (
      <>
        {sellerNotice}
        {withExpiry(
          <WebViewer
            slug={slug}
            documentName={link.document.name}
            senderName={senderName}
            externalUrl={link.document.externalUrl}
            embedUrl={link.document.embedUrl}
            readerHtml={reader?.readerHtml ?? null}
            labels={labels}
            ctaEnabled={link.ctaEnabled}
            signerName={signerName}
            booking={booking}
            forward={forward}
            dealStatus={link.dealStatus}
            locale={locale}
            chat={chat}
            countdown={!!deadline && countdown}
            welcome={
              capsules.find((capsule) => capsule.pageNumber === WELCOME_PAGE) ??
              null
            }
            translation={reader?.readerHtml ? translation : null}
          />,
        )}
      </>
    );
  }

  // The pricing pages carry the countdown, and open the decision strip once reached
  const pricingPages = (
    await prisma.documentPage.findMany({
      where: { documentId: link.document.id, tags: { has: "PRICING" } },
      select: { pageNumber: true },
    })
  ).map((page) => page.pageNumber);

  return (
    <>
      {sellerNotice}
      {withExpiry(
        <PdfViewer
          slug={slug}
          fileUrl={`/api/v/${slug}/file`}
          documentName={link.document.name}
          senderName={senderName}
          labels={labels}
          ctaEnabled={link.ctaEnabled}
          signerName={signerName}
          booking={booking}
          forward={forward}
          dealStatus={link.dealStatus}
          locale={locale}
          chat={chat}
          countdown={deadline && countdown ? { pricingPages } : null}
          decisionPages={pricingPages}
          capsules={capsules}
          voiceComments={link.voiceCommentsEnabled}
          translation={translation}
        />,
      )}
    </>
  );
}

function SellerNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="fixed top-[calc(0.5rem+env(safe-area-inset-top))] left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-sm bg-foreground px-3 py-1.5 text-center text-small text-background shadow-md"
    >
      {children}
    </p>
  );
}

/** This reader already asked for this expiry date: show the confirmation, not the button again. */
async function alreadyRequestedExtension(
  link: ViewerLink,
  email: string | null,
) {
  const prospect = email
    ? await prisma.prospect.findUnique({
        where: { linkId_email: { linkId: link.id, email } },
        select: { id: true },
      })
    : null;
  const who = prospect?.id ?? (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!who || !link.expiresAt) return false;
  const alert = await prisma.sellerAlert.findUnique({
    where: { dedupeKey: extensionRequestKey(link.id, link.expiresAt, who) },
    select: { id: true },
  });
  return !!alert;
}

/** The seller's clip for each page: this link's own, or the document's. */
async function loadCapsules(
  slug: string,
  link: { id: string; documentId: string; shared: boolean },
): Promise<ViewerCapsule[]> {
  const rows = await prisma.pageCapsule.findMany({
    where: capsulesVisibleOnLink(link),
    select: {
      id: true,
      pageNumber: true,
      linkId: true,
      kind: true,
      hookText: true,
      posterPathname: true,
    },
  });
  return [...resolveCapsules(rows, link.id).values()].map((row) => {
    const src = `/api/v/${slug}/capsules/${row.id}/media`;
    return {
      id: row.id,
      pageNumber: row.pageNumber,
      kind: row.kind,
      hookText: row.hookText,
      src,
      poster: row.posterPathname ? `${src}?poster` : null,
    };
  });
}

/**
 * What the reader can do with the document's language. Documents read before
 * the AI gave their language get a guess from their first pages.
 */
async function loadTranslation(
  link: { translationEnabled: boolean; document: { id: string; kind: DocumentKind; language: string | null } },
  reader: { chosen: SupportedLocale | null; browserLocale: SupportedLocale },
): Promise<ViewerTranslation | null> {
  // PDFs go to DeepL, which keeps their layout; web articles to the AI
  const available = link.document.kind === "FILE" ? !!deeplConfig() : !!getLanguageModel("translate");
  if (!link.translationEnabled || !available) return null;
  let source = link.document.language;
  if (!source) {
    const pages = await prisma.documentPage.findMany({
      where: { documentId: link.document.id, text: { not: null } },
      orderBy: { pageNumber: "asc" },
      take: 3,
      select: { text: true },
    });
    source = guessLanguage(pages.map((page) => page.text).join("\n"));
  }
  return {
    source,
    target: translationTarget(reader.chosen, source),
    offer: !reader.chosen && source && source !== reader.browserLocale ? reader.browserLocale : null,
  };
}

// Shown only when on for the link, an AI is configured and the document has something to answer from
async function loadChatWidget(
  link: { id: string; chatEnabled: boolean; document: { id: string } },
  labels: ViewerLabels,
): Promise<ChatWidgetData | null> {
  if (!link.chatEnabled || !getLanguageModel("chat")) return null;
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  const setup = await loadChatSetup(
    { id: link.id, documentId: link.document.id },
    visitorId,
  );
  if (!setup.hasKnowledge) return null;
  return {
    kind: setup.kind,
    initialMessages: toUIMessages(setup.history),
    suggestions: suggestQuestions(setup.tags, labels.chatKinds[setup.kind]),
  };
}
