"use client";

import { useTransition } from "react";
import { toast } from "sonner";

import { cancelFollowup, sendFollowupNow } from "@/app/(dashboard)/followup-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { FollowupChannel, FollowupStatus, FollowupTrigger } from "@/generated/prisma/enums";

import { CHANNEL_LABELS, FOLLOWUP_STATUS_LABELS, FOLLOWUP_TRIGGER_LABELS } from "./labels";

export type FollowupItem = {
  id: string;
  status: FollowupStatus;
  trigger: FollowupTrigger;
  channel: FollowupChannel;
  scheduledFor: Date;
  timezone: string;
  subject: string | null;
  body: string | null;
  error: string | null;
  aiProvider: string | null;
  aiModel: string | null;
  sentAt: Date | null;
  recipient: string;
  linkName: string;
};

const OUTCOME_MESSAGES: Record<string, string> = {
  sent: "Relance envoyée",
  failed: "Échec de l'envoi, voir le détail",
  cancelled: "Relance annulée : la situation a changé",
  skipped: "Relance ignorée",
  ignored: "Rien à envoyer",
};

function formatInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusVariant(status: FollowupStatus) {
  if (status === "SENT" || status === "DELIVERED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  if (status === "GENERATED" || status === "SCHEDULED" || status === "PENDING") return "secondary" as const;
  return "outline" as const;
}

export function FollowupsPanel({ followups }: { followups: FollowupItem[] }) {
  const [pending, startTransition] = useTransition();

  if (followups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune relance pour l&apos;instant. Elles se créent toutes seules selon le comportement du prospect.
      </p>
    );
  }

  return (
    <ul className="divide-y">
      {followups.map((f) => {
        const open = f.status === "GENERATED" || f.status === "SCHEDULED";
        return (
          <li key={f.id} className="space-y-2 py-4 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <Badge variant={statusVariant(f.status)}>{FOLLOWUP_STATUS_LABELS[f.status]}</Badge>
              <span className="font-medium">{FOLLOWUP_TRIGGER_LABELS[f.trigger]}</span>
              <span className="text-muted-foreground">
                · {CHANNEL_LABELS[f.channel]} · {f.recipient} · {f.linkName}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {f.sentAt
                ? `Envoyée le ${formatInZone(f.sentAt, f.timezone)}`
                : `Prévue le ${formatInZone(f.scheduledFor, f.timezone)} (heure du prospect, ${f.timezone})`}
              {" · "}
              {f.aiProvider === "template" ? "modèle de secours (pas de clé IA)" : `rédigée par IA (${f.aiModel})`}
            </p>

            {f.body && (
              <details className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
                <summary className="cursor-pointer select-none font-medium">
                  {f.subject ?? "Message WhatsApp"}
                </summary>
                <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{f.body}</p>
              </details>
            )}

            {f.error && f.status !== "SENT" && <p className="text-xs text-destructive">{f.error}</p>}

            {open && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const { outcome } = await sendFollowupNow(f.id);
                      (outcome === "sent" ? toast.success : toast.error)(OUTCOME_MESSAGES[outcome]);
                    })
                  }
                >
                  Envoyer maintenant
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await cancelFollowup(f.id);
                      toast.success("Relance annulée");
                    })
                  }
                >
                  Annuler
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
