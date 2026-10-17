import type { Ref } from "react";

const ARTICLE_STYLES = [
  "text-[1.0625rem] leading-relaxed break-words",
  "[&_p]:my-4 [&_hr]:my-8 [&_hr]:border-border [&_a]:underline [&_a]:decoration-foreground/40 [&_a]:underline-offset-[3px]",
  "[&_h2]:mt-9 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h3]:mt-7 [&_h3]:mb-2 [&_h3]:text-heading [&_h4]:mt-5 [&_h4]:font-semibold",
  "[&_ul]:my-4 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1",
  "[&_blockquote]:my-5 [&_blockquote]:border-l [&_blockquote]:border-foreground/30 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground",
  "[&_figure]:my-6 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-sm [&_figcaption]:mt-2 [&_figcaption]:text-sm [&_figcaption]:text-muted-foreground",
  "[&_pre]:my-4 [&_pre]:overflow-x-auto [&_pre]:rounded-sm [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:text-sm",
  "[&_table]:my-4 [&_table]:block [&_table]:overflow-x-auto [&_table]:text-sm [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:p-2",
].join(" ");

const siteName = (url: string) => new URL(url).hostname.replace(/^www\./, "");

type Props = {
  ref?: Ref<HTMLElement>;
  /** Rebuilt server side from a short list of tags, every text escaped (reader-view.ts). */
  html: string;
  title: string;
  sourceLabel: string;
  externalUrl: string;
  onOpen?: () => void;
  /** Set when the article is shown translated. */
  lang?: string;
};

// The article of a site that refuses framing, read in Clozer like a PDF page
export function ReaderArticle({ ref, html, title, sourceLabel, externalUrl, onOpen, lang }: Props) {
  return (
    <article
      ref={ref}
      lang={lang}
      data-page={1}
      className="mx-auto w-full max-w-2xl bg-card px-5 py-8 ring-1 ring-border sm:px-10 sm:py-10"
    >
      <p className="mb-3 text-small text-muted-foreground">
        {sourceLabel}{" "}
        <a
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onOpen}
          className="font-mono text-foreground underline decoration-foreground/40 underline-offset-[3px]"
        >
          {siteName(externalUrl)}
        </a>
      </p>
      <h1 className="condensed mb-6 text-title font-bold">{title}</h1>
      {/* The original, or its translation cleaned again the same way (translation/translate.ts) */}
      <div className={ARTICLE_STYLES} dangerouslySetInnerHTML={{ __html: html }} />
    </article>
  );
}
