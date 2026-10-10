"use client";

import { RefreshCw } from "lucide-react";
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
import { PageCapsuleControl, type CapsuleSummary } from "@/components/dashboard/page-capsule";
import type { PageTag, PageTagSource } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";

import { DOC_TYPE_LABELS, DOC_TYPES, tagLabels, type DocType } from "@/lib/closing/documents/doc-types";

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
}: {
  documentId: string;
  pages: ContentPage[];
  capsuleUploadPrefix: string;
  docType: string | null;
  docPurpose: string | null;
  aiRead: boolean;
  aiAvailable: boolean;
  /** Three readings failed: only the button retries now. */
  aiGaveUp: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const labels = tagLabels(docType);

  return (
    <div className="space-y-4">
      {docPurpose && <p className="text-body text-muted-foreground">{docPurpose}</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-body text-muted-foreground">
          {aiRead
            ? "Résumé de chaque page, lu par l'IA. Les étiquettes disent à Clozer où sont les tarifs, le planning… Corrigez-les si besoin : votre choix ne sera plus touché."
            : aiAvailable && aiGaveUp
              ? "L'IA n'a pas réussi à lire ce document. Réessayez avec « Relire les pages »."
              : aiAvailable
                ? "L'IA est en train de lire les pages (une minute environ). Rechargez la page pour voir les résumés."
              : "Étiquettes repérées par mots-clés. Corrigez-les si besoin : votre choix ne sera plus touché."}
        </p>
        {aiAvailable && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await rereadDocument(documentId);
                if (result.error) toast.error(result.error);
                else toast.success("Pages relues");
              })
            }
          >
            <RefreshCw className={cn(pending && "animate-spin")} /> {pending ? "Lecture…" : "Relire les pages"}
          </Button>
        )}
      </div>
      <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-border">
        {pages.map((page) => (
          // Remount when the stored tags change (AI reread), so the row shows them
          <PageRow
            key={`${page.pageNumber}:${page.tags.join()}:${docType}`}
            documentId={documentId}
            page={page}
            labels={labels}
            capsuleUploadPrefix={capsuleUploadPrefix}
          />
        ))}
      </ul>
    </div>
  );
}

function PageRow({
  documentId,
  page,
  labels,
  capsuleUploadPrefix,
}: {
  documentId: string;
  page: ContentPage;
  labels: Record<PageTag, string>;
  capsuleUploadPrefix: string;
}) {
  const [tags, setTags] = useState(page.tags);
  const [pending, startTransition] = useTransition();

  const toggle = (tag: PageTag) => {
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
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
    <li className="grid gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[3rem_minmax(0,1fr)]">
      <span className="text-sm font-medium text-muted-foreground tabular-nums">p.{page.pageNumber}</span>
      <div className="min-w-0 space-y-2">
        {page.summary && <p className="text-body">{page.summary}</p>}
        {page.keyFacts.length > 0 && (
          <p className="text-sm text-muted-foreground">{page.keyFacts.join(" · ")}</p>
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
                  "rounded-full px-2.5 py-0.5 text-xs ring-1 transition-colors",
                  on
                    ? "bg-foreground text-background ring-foreground"
                    : "text-muted-foreground ring-border hover:text-foreground",
                )}
              >
                {labels[tag]}
              </button>
            );
          })}
          {page.tagSource === "MANUAL" && <span className="text-xs text-muted-foreground">corrigé par vous</span>}
        </div>
        <PageCapsuleControl
          target={{ documentId, linkId: null, pageNumber: page.pageNumber, uploadPrefix: capsuleUploadPrefix }}
          capsule={page.capsule}
        />
      </div>
    </li>
  );
}

/** Web links have no readable text: the seller describes the page instead. */
export function SellerDescriptionForm({ documentId, initial }: { documentId: string; initial: string }) {
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
          else toast.success("Description enregistrée");
        });
      }}
    >
      <p className="text-body text-muted-foreground">
        Clozer ne peut pas lire le contenu d&apos;une page web. Dites en quelques lignes ce qu&apos;elle présente
        (offre, prix, options, planning) : l&apos;IA s&apos;en servira pour comprendre vos deals et écrire les relances.
      </p>
      <Textarea
        aria-label="Ce que présente la page"
        rows={5}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Présentation de l'offre Growth : audit, refonte, 3 mois d'accompagnement. 14 500 € HT, paiement en 3 fois possible."
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || value === initial}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}

const TYPE_ITEMS = DOC_TYPES.map((value) => ({ value, label: DOC_TYPE_LABELS[value] }));

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
  const [optimistic, setOptimistic] = useOptimistic(docType);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Select
        items={TYPE_ITEMS}
        value={optimistic ?? null}
        disabled={pending}
        onValueChange={(value) => {
          if (!value) return;
          startTransition(async () => {
            setOptimistic(value);
            const result = await setDocumentType(documentId, value);
            if (result.error) toast.error(result.error);
            else toast.success(`Type « ${DOC_TYPE_LABELS[value as DocType]} » enregistré`);
          });
        }}
      >
        <SelectTrigger aria-label="Type de document" className="h-9 min-w-52 bg-card">
          <SelectValue placeholder="Type non détecté" />
        </SelectTrigger>
        <SelectContent>
          {TYPE_ITEMS.map((item) => (
            <SelectItem key={item.value} value={item.value}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <span className="text-sm text-muted-foreground">{setBySeller ? "choisi par vous" : "deviné par l'IA"}</span>
    </div>
  );
}

/** What the document leaves out, for the assistant that answers prospects. */
export function AssistantNotesForm({ documentId, initial }: { documentId: string; initial: string }) {
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
            toast.success("Infos enregistrées");
          }
        });
      }}
    >
      <p className="text-body text-muted-foreground">
        Ce que le document ne dit pas et que l&apos;assistant peut répondre au prospect : précisions techniques,
        hypothèses, ce qui est hors périmètre, options. S&apos;ajoute à ce que vous avez écrit dans les réglages.
        Rien de confidentiel : le prospect peut tout obtenir en posant la question.
      </p>
      <Textarea
        aria-label="Infos pour l'assistant"
        rows={5}
        maxLength={4000}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Le site WordPress n'est pas couvert par l'audit. Les estimations sont en jours-homme, à 650 € HT le jour. Démarrage possible sous 2 semaines."
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending || value === saved}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
