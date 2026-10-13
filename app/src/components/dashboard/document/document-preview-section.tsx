import { DocumentPreview } from "@/components/dashboard/document-preview";
import { ReaderArticle } from "@/components/viewer/reader-article";

/** The document as prospects see it: the PDF, the video, or the web page (embedded or as an article). */
export function DocumentPreviewSection({
  document,
  ready,
}: {
  document: {
    id: string;
    name: string;
    kind: string;
    embedUrl: string | null;
    readerHtml: string | null;
    externalUrl: string | null;
    posterPathname: string | null;
  };
  ready: boolean;
}) {
  const fileUrl = `/api/documents/${document.id}/file`;

  if (document.kind === "URL") {
    if (document.embedUrl) {
      return (
        <iframe
          src={document.embedUrl}
          title={document.name}
          className="h-[75vh] w-full border border-foreground bg-card"
          allow="autoplay; fullscreen; clipboard-write; encrypted-media; picture-in-picture"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-forms allow-presentation"
        />
      );
    }
    if (document.readerHtml && document.externalUrl) {
      return (
        <div className="max-h-[75vh] overflow-y-auto border border-foreground bg-muted/60 p-4">
          <ReaderArticle
            html={document.readerHtml}
            title={document.name}
            sourceLabel="Version lecture de"
            externalUrl={document.externalUrl}
          />
        </div>
      );
    }
    return (
      <p className="border-y border-border py-12 text-center text-body text-muted-foreground">
        Ce site refuse l&apos;affichage intégré. Vos prospects verront un bouton pour l&apos;ouvrir dans un nouvel
        onglet.{" "}
        <a
          href={document.externalUrl ?? undefined}
          target="_blank"
          rel="noopener noreferrer"
          className="text-foreground underline underline-offset-4"
        >
          Ouvrir la page
        </a>
      </p>
    );
  }

  if (document.kind === "VIDEO") {
    return (
      <video
        src={fileUrl}
        poster={document.posterPathname ? `${fileUrl}?poster` : undefined}
        controls
        playsInline
        preload="metadata"
        className="aspect-video w-full border border-foreground bg-black"
      />
    );
  }

  if (!ready) {
    return (
      <p className="border-y border-border py-12 text-center text-body text-muted-foreground">
        L&apos;aperçu s&apos;affichera une fois l&apos;analyse terminée.
      </p>
    );
  }

  return <DocumentPreview fileUrl={fileUrl} />;
}
