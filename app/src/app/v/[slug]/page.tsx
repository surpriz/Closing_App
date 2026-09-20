import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { EmailGate } from "@/components/viewer/email-gate";
import { PdfViewer } from "@/components/viewer/pdf-viewer";
import { getViewerLabels, pickLocale } from "@/lib/closing/i18n/viewer";
import { getLinkForViewer, getViewerAccess } from "@/lib/closing/links";

import { unlockWithEmail } from "./actions";

export async function generateMetadata({ params }: PageProps<"/v/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const link = await getLinkForViewer(slug);
  return {
    title: link?.document.name ?? "Document",
    robots: { index: false, follow: false },
  };
}

export default async function ViewerPage({ params }: PageProps<"/v/[slug]">) {
  const { slug } = await params;
  const link = await getLinkForViewer(slug);
  if (!link) notFound();

  const locale = pickLocale((await headers()).get("accept-language"));
  const labels = getViewerLabels(locale);
  const access = await getViewerAccess(link);

  if (!access.allowed) {
    return (
      <EmailGate
        action={unlockWithEmail.bind(null, slug)}
        documentName={link.document.name}
        labels={labels}
      />
    );
  }

  if (link.document.status !== "READY") {
    return (
      <main className="flex flex-1 items-center justify-center px-4 text-center text-sm text-muted-foreground">
        {labels.processing}
      </main>
    );
  }

  return (
    <PdfViewer
      slug={slug}
      fileUrl={`/api/v/${slug}/file`}
      documentName={link.document.name}
      labels={labels}
      ctaEnabled={link.ctaEnabled}
      dealStatus={link.dealStatus}
    />
  );
}
