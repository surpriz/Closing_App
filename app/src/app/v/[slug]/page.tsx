import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import { notFound } from "next/navigation";

import { AutoRefresh } from "@/components/dashboard/auto-refresh";
import type { ChatWidgetData } from "@/components/viewer/chat-widget";
import { EmailGate } from "@/components/viewer/email-gate";
import { ExpiryGate } from "@/components/viewer/expiry-gate";
import { LinkExpired } from "@/components/viewer/link-expired";
import { PdfViewer } from "@/components/viewer/pdf-viewer";
import { WebViewer } from "@/components/viewer/web-viewer";
import { getLanguageModel } from "@/lib/closing/ai/provider";
import { suggestQuestions, toUIMessages } from "@/lib/closing/chat/messages";
import { loadChatSetup } from "@/lib/closing/chat/queries";
import { extensionRequestKey, showsCountdown } from "@/lib/closing/expiry";
import { getViewerLabels, pickLocale, type ViewerLabels } from "@/lib/closing/i18n/viewer";
import { getViewerAccess, resolveViewerLink, type ViewerLink } from "@/lib/closing/links";
import { VISITOR_COOKIE } from "@/lib/closing/tracking/visitor";
import { prisma } from "@/lib/db";
import { isWorkspaceMember } from "@/lib/session";

import { requestLinkExtension, unlockWithEmail } from "./actions";

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

export default async function ViewerPage({ params }: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const resolved = await resolveViewerLink(slug);
  if (!resolved) notFound();
  const { link, expired } = resolved;

  const locale = pickLocale((await headers()).get("accept-language"));
  const labels = getViewerLabels(locale);
  const [access, settings, isSeller] = await Promise.all([
    getViewerAccess(link),
    prisma.workspaceSettings.findUnique({
      where: { organizationId: link.organizationId },
      select: { senderName: true },
    }),
    isWorkspaceMember(link.organizationId),
  ]);
  const senderName = settings?.senderName?.trim() || null;
  const countdown = showsCountdown(link.document.docType);

  const locked = (
    <LinkExpired
      action={requestLinkExtension.bind(null, slug)}
      documentName={link.document.name}
      senderName={senderName}
      labels={labels}
      quote={countdown}
      email={access.email ? "known" : link.requireEmail ? "required" : "optional"}
      alreadyRequested={expired && (await alreadyRequestedExtension(link, access.email))}
    />
  );

  // Before the email gate: there is nothing to unlock any more, only more time to ask for
  if (expired) {
    return (
      <>
        {isSeller && (
          <SellerNotice>Ce lien a expiré pour le prospect : voici ce qu&apos;il voit.</SellerNotice>
        )}
        {locked}
      </>
    );
  }

  if (!access.allowed) {
    return (
      <EmailGate
        action={unlockWithEmail.bind(null, slug)}
        documentName={link.document.name}
        senderName={senderName}
        labels={labels}
      />
    );
  }

  if (link.document.status === "FAILED") {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <p role="status" className="text-sm text-muted-foreground">
          {labels.unavailable}
        </p>
      </main>
    );
  }

  // Links made from the mail extension can be opened while the PDF is still being read
  if (link.document.status !== "READY") {
    return (
      <main className="flex flex-1 items-center justify-center px-4">
        <AutoRefresh intervalMs={4000} />
        <p role="status" className="flex items-center gap-3 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {labels.processing}
        </p>
      </main>
    );
  }

  const chat = await loadChatWidget(link, labels);

  const sellerNotice = isSeller && (
    <SellerNotice>
      Vous êtes connecté à Clozer : cette lecture ne compte pas. Testez dans un
      autre navigateur.
    </SellerNotice>
  );

  // Ticks down in the page and swaps to the locked screen at zero
  const withExpiry = (viewer: React.ReactNode) =>
    link.expiresAt ? (
      <ExpiryGate expiresAt={link.expiresAt.toISOString()} serverNow={new Date().toISOString()} locked={locked}>
        {viewer}
      </ExpiryGate>
    ) : (
      viewer
    );

  if (link.document.kind === "URL" && link.document.externalUrl) {
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
            labels={labels}
            ctaEnabled={link.ctaEnabled}
            dealStatus={link.dealStatus}
            locale={locale}
            chat={chat}
            countdown={!!link.expiresAt && countdown}
          />,
        )}
      </>
    );
  }

  const pricingPages =
    link.expiresAt && countdown
      ? (
          await prisma.documentPage.findMany({
            where: { documentId: link.document.id, tags: { has: "PRICING" } },
            select: { pageNumber: true },
          })
        ).map((page) => page.pageNumber)
      : null;

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
          dealStatus={link.dealStatus}
          locale={locale}
          chat={chat}
          countdown={pricingPages && { pricingPages }}
        />,
      )}
    </>
  );
}

function SellerNotice({ children }: { children: React.ReactNode }) {
  return (
    <p
      role="status"
      className="fixed top-3 left-1/2 z-50 -translate-x-1/2 rounded-full bg-foreground px-4 py-1.5 text-xs text-background shadow-lg"
    >
      {children}
    </p>
  );
}

/** This reader already asked for this expiry date: show the confirmation, not the button again. */
async function alreadyRequestedExtension(link: ViewerLink, email: string | null) {
  const prospect = email
    ? await prisma.prospect.findUnique({ where: { linkId_email: { linkId: link.id, email } }, select: { id: true } })
    : null;
  const who = prospect?.id ?? (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!who || !link.expiresAt) return false;
  const alert = await prisma.sellerAlert.findUnique({
    where: { dedupeKey: extensionRequestKey(link.id, link.expiresAt, who) },
    select: { id: true },
  });
  return !!alert;
}

// Shown only when on for the link, an AI is configured and the document has something to answer from
async function loadChatWidget(
  link: { id: string; chatEnabled: boolean; document: { id: string } },
  labels: ViewerLabels,
): Promise<ChatWidgetData | null> {
  if (!link.chatEnabled || !getLanguageModel("chat")) return null;
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  const setup = await loadChatSetup({ id: link.id, documentId: link.document.id }, visitorId);
  if (!setup.hasKnowledge) return null;
  return {
    kind: setup.kind,
    initialMessages: toUIMessages(setup.history),
    suggestions: suggestQuestions(setup.tags, labels.chatKinds[setup.kind]),
  };
}
