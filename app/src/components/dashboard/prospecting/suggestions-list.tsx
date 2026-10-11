"use client";

import { Ban, ExternalLink, X } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  optOutSuggestionAction,
  rejectSuggestionAction,
  type ActionResult,
} from "@/app/(dashboard)/prospection/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { INVALID_LABELS, PROVIDER_LABELS, STATUS_LABELS } from "./labels";

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
};

function linkedinHref(row: SuggestionRow) {
  if (row.linkedinUrl) return row.linkedinUrl;
  // A search link only: profiles are never fetched
  const keywords = [row.firstName, row.lastName, row.companyName].filter(Boolean).join(" ");
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;
}

export function SuggestionsList({ rows }: { rows: SuggestionRow[] }) {
  const [pending, startTransition] = useTransition();

  const run = (action: () => Promise<ActionResult>, success?: string) =>
    startTransition(async () => {
      const result = await action();
      if ("error" in result) toast.error(result.error);
      else if (success) toast.success(success);
    });

  return (
    <ul className="divide-y">
      {rows.map((row) => (
        <li key={row.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="flex flex-wrap items-center gap-2 font-medium">
              {[row.firstName, row.lastName ?? row.lastNameMasked].filter(Boolean).join(" ") || "Contact"}
              <a
                href={linkedinHref(row)}
                target="_blank"
                rel="noreferrer"
                aria-label="Voir sur LinkedIn"
                className="text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="size-3.5" aria-hidden />
              </a>
            </p>
            <p className="truncate text-small text-muted-foreground">
              {[row.title, row.companyName].filter(Boolean).join(" · ")}
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant={row.status === "READY" ? "success" : row.status === "INVALID" ? "destructive" : "secondary"}>
                {row.status === "INVALID" && row.invalidReason ? INVALID_LABELS[row.invalidReason] : STATUS_LABELS[row.status]}
              </Badge>
              {row.nafVerified === false && <Badge variant="warning">Secteur non confirmé</Badge>}
              <span className="text-micro text-muted-foreground">via {PROVIDER_LABELS[row.provider] ?? row.provider}</span>
              {row.email && <span className="font-mono text-small">{row.email}</span>}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {row.status === "SUGGESTED" && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => rejectSuggestionAction(row.id))}>
                <X aria-hidden />
                Écarter
              </Button>
            )}
            {row.status !== "REJECTED" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                title="La personne a demandé à ne pas être contactée"
                onClick={() => run(() => optOutSuggestionAction(row.id), "Cette personne ne sera plus jamais proposée")}
              >
                <Ban aria-hidden />
                Ne plus proposer
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
