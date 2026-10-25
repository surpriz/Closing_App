"use client";

import { Check, ExternalLink, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTransition } from "react";
import { toast } from "sonner";

import { acceptSuggestionsAction, rejectSuggestionAction, type ActionResult } from "@/app/(dashboard)/prospecting/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { invalidLabel, providerLabel, statusLabel } from "./labels";
import { OptOutButton } from "./opt-out-button";
import { OutreachDialog } from "./outreach-dialog";

export type SuggestionRow = {
  id: string;
  provider: string;
  firstName: string | null;
  lastNameMasked: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  nafVerified: boolean | null;
  linkedinUrl: string | null;
  status: string;
  invalidReason: string | null;
  email: string | null;
  linkId: string | null;
};

function linkedinHref(row: SuggestionRow) {
  if (row.linkedinUrl) return row.linkedinUrl;
  // A search link only: profiles are never fetched
  const keywords = [row.firstName, row.lastName, row.companyName].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export function SuggestionsList({ rows, documents }: { rows: SuggestionRow[]; documents: { id: string; name: string; displayTitle: string | null; docType: string | null }[] }) {
  const t = useTranslations("prospecting.suggestions");
  const tl = useTranslations("prospecting.labels");
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) toast.error(result.error);
      else if (result.notice) toast.warning(result.notice);
    });

  return (
    <ul className="divide-y divide-border">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2 text-body font-semibold">
              {[row.firstName, row.lastName ?? row.lastNameMasked].filter(Boolean).join(" ") || t("contact")}
              <a
                href={linkedinHref(row)}
                target="_blank"
                rel="noreferrer"
                aria-label={row.linkedinUrl ? t("viewLinkedin") : t("searchLinkedin")}
                className="rounded-sm text-muted-foreground outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30"
              >
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </p>
            <p className="truncate text-small text-muted-foreground">
              {[row.title, row.companyName].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={row.status === "READY" ? "success" : row.status === "INVALID" ? "destructive" : "secondary"}>
                {row.status === "INVALID" && row.invalidReason ? invalidLabel(tl, row.invalidReason) : statusLabel(tl, row.status)}
              </Badge>
              {row.nafVerified === true && <Badge variant="success">{t("sectorConfirmed")}</Badge>}
              {row.nafVerified === false && <Badge variant="warning">{t("otherNaf")}</Badge>}
              <span className="text-micro text-muted-foreground">{t("via", { provider: providerLabel(tl, row.provider) })}</span>
              {row.email && <span className="text-small">{row.email}</span>}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {row.status === "READY" && (
              <OutreachDialog suggestionId={row.id} documents={documents} hasLink={!!row.linkId} />
            )}
            {row.status === "SUGGESTED" && (
              <Button size="sm" disabled={pending} onClick={() => run(() => acceptSuggestionsAction([row.id]))}>
                <Check aria-hidden />
                {t("reveal")}
              </Button>
            )}
            {row.status === "SUGGESTED" && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => rejectSuggestionAction(row.id))}>
                <X aria-hidden />
                {t("reject")}
              </Button>
            )}
            {row.status !== "REJECTED" && row.status !== "REVEALING" && (
              <OptOutButton suggestionId={row.id} name={row.firstName ?? t("thisPerson")} />
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
