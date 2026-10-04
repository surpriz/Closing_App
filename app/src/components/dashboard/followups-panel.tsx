"use client";

import { Check, Copy, Mail, RefreshCw } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  approveFollowup,
  cancelFollowup,
  markFollowupSentByMe,
  regenerateFollowup,
  saveFollowupDraft,
  sendFollowupNow,
} from "@/app/(dashboard)/followup-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FollowupStatus } from "@/generated/prisma/enums";
import { buildMailto } from "@/lib/closing/followups/mailto";

import type { FollowupItem } from "./followup-item";
import { CHANNEL_LABELS, FOLLOWUP_STATUS_LABELS, FOLLOWUP_TRIGGER_LABELS } from "./labels";

const OUTCOME_MESSAGES: Record<string, string> = {
  sent: "Relance envoyée",
  failed: "Échec de l'envoi, voir le détail",
  cancelled: "Relance annulée : la situation a changé",
  skipped: "Relance ignorée",
  ignored: "Rien à envoyer",
};

/** One-click instructions for "Réécrire". */
const REWRITE_PRESETS = ["Plus court", "Plus direct", "Proposer un appel", "Autre angle"];

function formatInZone(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone, dateStyle: "medium", timeStyle: "short" }).format(date);
}

function statusVariant(status: FollowupStatus) {
  if (status === "SENT" || status === "DELIVERED") return "default" as const;
  if (status === "FAILED") return "destructive" as const;
  if (status === "DRAFT") return "default" as const;
  if (status === "GENERATED" || status === "SCHEDULED" || status === "PENDING") return "secondary" as const;
  return "outline" as const;
}

function toastResult(result: { ok?: boolean; error?: string }, success: string) {
  if (result.error) toast.error(result.error);
  else toast.success(success);
}

export function FollowupsPanel({
  followups,
  showLink = false,
}: {
  followups: FollowupItem[];
  showLink?: boolean;
}) {
  if (followups.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Aucune relance pour l&apos;instant. Clozer les prépare selon ce que fait le prospect, et vous les validez.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {followups.map((f) => (
        <FollowupRow key={f.id} followup={f} showLink={showLink} />
      ))}
    </ul>
  );
}

function FollowupRow({ followup: f, showLink }: { followup: FollowupItem; showLink: boolean }) {
  const editable = f.status === "DRAFT" || f.status === "GENERATED" || f.status === "SCHEDULED";

  return (
    <li className="space-y-2.5 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <Badge variant={statusVariant(f.status)}>{FOLLOWUP_STATUS_LABELS[f.status]}</Badge>
        <span className="font-medium">{FOLLOWUP_TRIGGER_LABELS[f.trigger]}</span>
        <span className="text-muted-foreground">
          par {CHANNEL_LABELS[f.channel].toLowerCase()} à {f.recipient}
          {showLink && `, ${f.linkName}`}
        </span>
      </div>

      <p className="text-sm text-muted-foreground">
        {f.sentAt
          ? `Envoyée le ${formatInZone(f.sentAt, f.timezone)}${f.sentVia === "MANUAL" ? ", par vous" : ""}`
          : f.status === "DRAFT"
            ? `Conseillée pour le ${formatInZone(f.scheduledFor, f.timezone)}, heure du prospect. Elle attend votre accord.`
            : `Prévue le ${formatInZone(f.scheduledFor, f.timezone)}, heure du prospect`}
      </p>

      {f.rationale && <p className="text-sm">{f.rationale}</p>}

      {editable && f.body ? (
        <DraftEditor key={f.version} followup={f} />
      ) : (
        f.body && (
          <details className="group rounded-lg bg-muted px-3 py-2 text-sm">
            <summary className="cursor-pointer select-none font-medium">{f.subject ?? "Message WhatsApp"}</summary>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{f.body}</p>
          </details>
        )
      )}

      {f.error && f.status !== "SENT" && <p className="text-sm text-destructive">{f.error}</p>}
    </li>
  );
}

function DraftEditor({ followup: f }: { followup: FollowupItem }) {
  const [pending, startTransition] = useTransition();
  const [subject, setSubject] = useState(f.subject ?? "");
  const [body, setBody] = useState(f.body ?? "");
  const [rewriting, setRewriting] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [copied, setCopied] = useState(false);

  const dirty = subject !== (f.subject ?? "") || body !== (f.body ?? "");
  const isEmail = f.channel === "EMAIL";
  const mailto = isEmail ? buildMailto({ to: f.recipientEmail, subject: subject || null, body }) : null;

  // Edits are saved before any action, so what is approved is what is on screen
  const run = (action: () => Promise<void>) =>
    startTransition(async () => {
      if (dirty) {
        const saved = await saveFollowupDraft(f.id, { subject, body });
        if (saved.error) {
          toast.error(saved.error);
          return;
        }
      }
      await action();
    });

  const rewrite = (text: string) =>
    startTransition(async () => {
      const result = await regenerateFollowup(f.id, text);
      toastResult(result, "Nouvelle version prête");
      if (!result.error) {
        setRewriting(false);
        setInstruction("");
      }
    });

  return (
    <div className="space-y-2.5 rounded-lg bg-muted p-3">
      {isEmail && (
        <Input
          aria-label="Objet"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-background font-medium"
          disabled={pending}
        />
      )}
      <Textarea
        aria-label="Message"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-40 bg-background"
        disabled={pending}
      />
      <p className="text-xs text-muted-foreground">
        {f.aiProvider === "template" ? "Écrite à partir d'un modèle" : "Rédigée par l'IA"}
        {f.edited && ", retouchée par vous"}. Le lien de désinscription est ajouté à l&apos;envoi.
      </p>

      {rewriting && (
        <div className="space-y-2 rounded-md bg-background p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {REWRITE_PRESETS.map((preset) => (
              <Button key={preset} size="xs" variant="outline" disabled={pending} onClick={() => rewrite(preset)}>
                {preset}
              </Button>
            ))}
          </div>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              rewrite(instruction);
            }}
          >
            <Input
              aria-label="Ce qu'il faut changer"
              placeholder="Ou dites ce qu'il faut changer…"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={pending}
            />
            <Button type="submit" size="sm" disabled={pending}>
              Réécrire
            </Button>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {f.status === "DRAFT" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(async () => toastResult(await approveFollowup(f.id), "Relance validée, elle partira à l'heure prévue"))}
          >
            Valider
          </Button>
        )}
        <Button
          size="sm"
          variant={f.status === "DRAFT" ? "outline" : "default"}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const { outcome } = await sendFollowupNow(f.id);
              (outcome === "sent" ? toast.success : toast.error)(OUTCOME_MESSAGES[outcome]);
            })
          }
        >
          Envoyer maintenant
        </Button>
        {dirty && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                toast.success("Modifications enregistrées");
              })
            }
          >
            Enregistrer
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRewriting((v) => !v)}>
          <RefreshCw /> Réécrire
        </Button>
        {mailto && (
          <Button size="sm" variant="ghost" render={<a href={mailto} />} nativeButton={false}>
            <Mail /> Ouvrir dans ma messagerie
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await navigator.clipboard.writeText(isEmail && subject ? `${subject}\n\n${body}` : body);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} Copier
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(async () => toastResult(await markFollowupSentByMe(f.id), "Notée comme envoyée par vous"))}
        >
          Je l&apos;ai envoyée moi-même
        </Button>
        <Button
          size="sm"
          variant="ghost"
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
    </div>
  );
}
