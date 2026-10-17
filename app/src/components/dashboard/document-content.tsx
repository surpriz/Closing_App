"use client";

import { RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  rereadDocument,
  saveAssistantNotes,
  saveSellerDescription,
  setDocumentType,
  setPageTags,
} from "@/app/(dashboard)/documents/actions";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { docTypeLabel, tagLabels } from "@/components/dashboard/document/doc-type-labels";
import { PageCapsuleControl, type CapsuleSummary } from "@/components/dashboard/page-capsule";
import type { PageTag, PageTagSource } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { segmentLabel } from "@/lib/closing/documents/video-segments";

import { DOC_TYPES, type DocType } from "@/lib/closing/documents/doc-types";

const EDITABLE_TAGS: PageTag[] = ["PRICING", "TERMS", "TIMELINE", "SCOPE", "TEAM", "CASE_STUDY"];

export type ContentPage = {
  pageNumber: number;
  summary: string | null;
  keyFacts: string[];
  tags: PageTag[];
  tagSource: PageTagSource;
  capsule: CapsuleSummary | null;
};

/** What Clozer understood of each page, with tags the seller can correct. */
export function DocumentPages({
  documentId,
  pages,
  aiRead,
  aiAvailable,
  aiGaveUp,
  docType,
  docPurpose,
  capsuleUploadPrefix,
  video = false,
}: {
  documentId: string;
  pages: ContentPage[];
  /** A video pitch: each "page" is a tenth of its transcript. */
  video?: boolean;
  capsuleUploadPrefix: string;
  docType: string | null;
  docPurpose: string | null;
  aiRead: boolean;
  aiAvailable: boolean;
  /** Three readings failed: only the button retries now. */
  aiGaveUp: boolean;
}) {
  const t = useTranslations("documents.content");
  const td = useTranslations("documents");
  const labels = tagLabels(td, docType);

  return (
    <div className="space-y-4">
      {docPurpose && <p className="text-body text-muted-foreground">{docPurpose}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-body text-muted-foreground">
          {video
            ? aiRead
              ? t("videoRead")
              : aiAvailable && !aiGaveUp
                ? t("videoProcessing")
                : t("videoNoTranscript")
            : aiRead
              ? t("pagesRead")
              : aiAvailable && aiGaveUp
                ? t("aiGaveUp")
                : aiAvailable
                  ? t("aiReading")
                  : t("keywordTags")}
        </p>
        {aiAvailable && <RereadButton documentId={documentId} label={t("rereadPages")} done={t("pagesReread")} />}
      </div>
      <ul className="divide-y divide-border border-y border-foreground bg-card">
        {pages.map((page) => (
          // Remount when the stored tags change (AI reread), so the row shows them
          <PageRow
            key={`${page.pageNumber}:${page.tags.join()}:${docType}`}
            documentId={documentId}
            page={page}
            labels={labels}
            capsuleUploadPrefix={capsuleUploadPrefix}
            video={video}
          />
        ))}
      </ul>
    </div>
  );
}

function RereadButton({ documentId, label, done }: { documentId: string; label: string; done: string }) {
  const t = useTranslations("documents.content");
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await rereadDocument(documentId);
          if (result.error) toast.error(result.error);
          else toast.success(done);
        })
      }
    >
      <RefreshCw className={cn(pending && "animate-spin")} /> {pending ? t("rereading") : label}
    </Button>
  );
}

/** What Clozer read of a web page. Pages drawn in the browser give nothing: the seller's description takes over. */
export function WebPageReading({
  documentId,
  docPurpose,
  page,
  aiAvailable,
}: {
  documentId: string;
  docPurpose: string | null;
  /** Null when no text could be read from the page. */
  page: { summary: string | null; keyFacts: string[] } | null;
  aiAvailable: boolean;
}) {
  const t = useTranslations("documents.content");
  return (
    <div className="max-w-2xl space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          {docPurpose && <p className="text-body">{docPurpose}</p>}
          {page?.summary && <p className="text-body text-muted-foreground">{page.summary}</p>}
          {page && page.keyFacts.length > 0 && (
            <p className="text-small text-muted-foreground">{page.keyFacts.join(" · ")}</p>
          )}
          {!page && (
            <p className="text-body text-muted-foreground">{t("webNoText")}</p>
          )}
          {page && !page.summary && aiAvailable && (
            <p className="text-body text-muted-foreground">{t("webAiReading")}</p>
          )}
        </div>
        <RereadButton documentId={documentId} label={t("rereadPage")} done={t("pageReread")} />
      </div>
    </div>
  );
}

function PageRow({
  documentId,
  page,
  labels,
  capsuleUploadPrefix,
  video,
}: {
  documentId: string;
  page: ContentPage;
  labels: Record<PageTag, string>;
  capsuleUploadPrefix: string;
  video: boolean;
}) {
  const t = useTranslations("documents.content");
  const locale = useLocale();
  const [tags, setTags] = useState(page.tags);
  const [pending, startTransition] = useTransition();

  const toggle = (tag: PageTag) => {
    const next = tags.includes(tag) ? tags.filter((other) => other !== tag) : [...tags, tag];
    setTags(next);
    startTransition(async () => {
      const result = await setPageTags(documentId, page.pageNumber, next);
      if (result.error) {
        toast.error(result.error);
        setTags(tags);
      }
    });
  };

  return (
    <li className={cn("grid gap-x-4 gap-y-2 px-3 py-3 sm:px-4", video ? "sm:grid-cols-[5.5rem_minmax(0,1fr)]" : "sm:grid-cols-[3rem_minmax(0,1fr)]")}>
      <span className="font-mono text-small text-muted-foreground">
        {video ? segmentLabel(page.pageNumber, undefined, locale) : t("pageShort", { page: page.pageNumber })}
      </span>
      <div className="min-w-0 space-y-2">
        {page.summary && <p className="text-body">{page.summary}</p>}
        {page.keyFacts.length > 0 && (
          <p className="text-small text-muted-foreground">{page.keyFacts.join(" · ")}</p>
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {EDITABLE_TAGS.map((tag) => {
            const on = tags.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                disabled={pending}
                onClick={() => toggle(tag)}
                className={cn(
                  "rounded-sm px-2 py-0.5 text-small ring-1 transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/30",
                  on
                    ? "bg-foreground text-background ring-foreground"
                    : "bg-card text-muted-foreground ring-input hover:text-foreground hover:ring-foreground/60",
                )}
              >
                {labels[tag]}
              </button>
            );
          })}
          {page.tagSource === "MANUAL" && <span className="text-small text-muted-foreground">{t("correctedByYou")}</span>}
        </div>
        {/* Recorded before the welcome message: kept on its page, no new ones */}
        {page.capsule && (
          <PageCapsuleControl
            target={{ documentId, linkId: null, pageNumber: page.pageNumber, uploadPrefix: capsuleUploadPrefix }}
            capsule={page.capsule}
            legacy
          />
        )}
      </div>
    </li>
  );
}

/** What the page holds beyond its text, in the seller's words. */
export function SellerDescriptionForm({ documentId, initial }: { documentId: string; initial: string }) {
  const t = useTranslations("documents.content");
  const [value, setValue] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-2xl space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveSellerDescription(documentId, value);
          if (result.error) toast.error(result.error);
          else toast.success(t("descriptionSaved"));
        });
      }}
    >
      <p className="text-body text-muted-foreground">{t("descriptionIntro")}</p>
      <Textarea
        aria-label={t("descriptionAria")}
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("descriptionPlaceholder")}
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || value === initial}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}

/** The AI guesses the type; the seller corrects it. It changes the tag names and how the assistant talks. */
export function DocumentTypeSelect({
  documentId,
  docType,
  setBySeller,
}: {
  documentId: string;
  docType: string | null;
  setBySeller: boolean;
}) {
  const t = useTranslations("documents.content");
  const td = useTranslations("documents");
  const typeItems = DOC_TYPES.map((value) => ({ value, label: docTypeLabel(td, value) }));
  const [optimistic, setOptimistic] = useOptimistic(docType);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Select
        items={typeItems}
        value={optimistic ?? null}
        disabled={pending}
        onValueChange={(value) => {
          if (!value) return;
          startTransition(async () => {
            setOptimistic(value);
            const result = await setDocumentType(documentId, value);
            if (result.error) toast.error(result.error);
            else toast.success(t("typeSaved", { type: docTypeLabel(td, value as DocType) }));
          });
        }}
      >
        <SelectTrigger aria-label={t("typeAria")} className="h-9 min-w-52 bg-card">
          <SelectValue placeholder={t("typePlaceholder")} />
        </SelectTrigger>
        <SelectContent>
          {typeItems.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-small text-muted-foreground">{setBySeller ? t("typeBySeller") : t("typeByAi")}</span>
    </div>
  );
}

/** What the document leaves out, for the assistant that answers prospects. */
export function AssistantNotesForm({ documentId, initial }: { documentId: string; initial: string }) {
  const t = useTranslations("documents.content");
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="max-w-2xl space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveAssistantNotes(documentId, value);
          if (result.error) toast.error(result.error);
          else {
            setSaved(value);
            toast.success(t("notesSaved"));
          }
        });
      }}
    >
      <p className="text-body text-muted-foreground">{t("notesIntro")}</p>
      <Textarea
        aria-label={t("notesAria")}
        rows={5}
        maxLength={4000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("notesPlaceholder")}
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || value === saved}>
        {pending ? t("saving") : t("save")}
      </Button>
    </form>
  );
}
