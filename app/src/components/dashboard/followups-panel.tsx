"use client";

import { Check, Copy, Mail, RefreshCw } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
import { copyMessage } from "@/lib/clipboard";
import { buildMailto } from "@/lib/closing/followups/mailto";
import { formatInTimeZone } from "@/lib/format";

import type { FollowupItem } from "./followup-item";

const OUTCOME_KEYS = {
  sent: "outcomeSent",
  failed: "outcomeFailed",
  cancelled: "outcomeCancelled",
  skipped: "outcomeSkipped",
  ignored: "outcomeIgnored",
} as const;

/** One-click instructions for "Réécrire". */
const REWRITE_PRESETS = ["presetShorter", "presetDirect", "presetCall", "presetAngle"] as const;

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
  emptyHint,
}: {
  followups: FollowupItem[];
  showLink?: boolean;
  /** Why there is nothing yet, e.g. what the latest analysis advised. */
  emptyHint?: string | null;
}) {
  const t = useTranslations("deal.followupsPanel");
  if (followups.length === 0) {
    return (
      <div className="space-y-1.5 text-body">
        <p className="font-medium">{t("emptyTitle")}</p>
        <p className="text-small text-muted-foreground">
          {emptyHint ?? t("emptyHint")}
        </p>
      </div>
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
  const t = useTranslations("deal.followupsPanel");
  const tl = useTranslations("labels");
  const locale = useLocale();
  const formatInZone = (date: Date, timeZone: string) => formatInTimeZone(date, timeZone, locale);

  return (
    <li className="space-y-2.5 py-4 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-small">
        <Badge variant={statusVariant(f.status)}>{tl(`followupStatus.${f.status}`)}</Badge>
        <span className="font-medium">{tl(`followupTrigger.${f.trigger}`)}</span>
        <span className="text-muted-foreground">
          {t("via", { channel: tl(`channel.${f.channel}`).toLowerCase(), recipient: f.recipient })}
          {showLink && `, ${f.linkName}`}
        </span>
      </div>

      <p className="text-small text-muted-foreground">
        {f.sentAt
          ? `${t("sentOn", { date: formatInZone(f.sentAt, f.timezone) })}${f.sentVia === "MANUAL" ? t("byYou") : ""}`
          : f.status === "DRAFT"
            ? t("draftFor", { date: formatInZone(f.scheduledFor, f.timezone) })
            : t("plannedFor", { date: formatInZone(f.scheduledFor, f.timezone) })}
      </p>

      {f.rationale && (
        <p className="text-body">
          <span className="font-medium">{t("why")} </span>
          {f.rationale}
          {f.confidence !== null && <span className="text-muted-foreground"> {t("confidence", { value: f.confidence })}</span>}
        </p>
      )}

      {editable && f.body ? (
        <DraftEditor key={f.version} followup={f} />
      ) : (
        f.body && (
          <details className="group border-l border-foreground/30 pl-3 text-body">
            <summary className="cursor-pointer select-none font-medium">{f.subject ?? t("whatsappMessage")}</summary>
            <p className="mt-2 max-w-prose whitespace-pre-wrap text-muted-foreground">{f.body}</p>
          </details>
        )
      )}

      {f.error && f.status !== "SENT" && <p className="text-small text-destructive">{f.error}</p>}
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
  const t = useTranslations("deal.followupsPanel");

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
      toastResult(result, t("newVersion"));
      if (!result.error) {
        setRewriting(false);
        setInstruction("");
      }
    });

  return (
    <div className="space-y-2.5 border border-border bg-muted/50 p-3">
      {isEmail && (
        <Input
          aria-label={t("subject")}
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="bg-card font-medium"
          disabled={pending}
        />
      )}
      <Textarea
        aria-label={t("message")}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className="min-h-40 bg-card text-body"
        disabled={pending}
      />
      <p className="text-small text-muted-foreground">
        {f.aiProvider === "template" ? t("fromTemplate") : t("byAi")}
        {f.edited && t("editedByYou")}. {t("unsubscribeNote")}
      </p>

      {rewriting && (
        <div className="space-y-2 border border-border bg-card p-2.5">
          <div className="flex flex-wrap gap-1.5">
            {REWRITE_PRESETS.map((preset) => (
              <Button key={preset} size="xs" variant="outline" disabled={pending} onClick={() => rewrite(t(preset))}>
                {t(preset)}
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
              aria-label={t("changeAria")}
              placeholder={t("changePlaceholder")}
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={pending}
            />
            <Button type="submit" size="sm" disabled={pending}>
              {t("rewrite")}
            </Button>
          </form>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {f.status === "DRAFT" && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => run(async () => toastResult(await approveFollowup(f.id), t("approved")))}
          >
            {t("approve")}
          </Button>
        )}
        <Button
          size="sm"
          variant={f.status === "DRAFT" ? "outline" : "default"}
          disabled={pending}
          onClick={() =>
            run(async () => {
              const { outcome } = await sendFollowupNow(f.id);
              (outcome === "sent" ? toast.success : toast.error)(
                outcome in OUTCOME_KEYS ? t(OUTCOME_KEYS[outcome as keyof typeof OUTCOME_KEYS]) : undefined,
              );
            })
          }
        >
          {t("sendNow")}
        </Button>
        {dirty && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() =>
              run(async () => {
                toast.success(t("changesSaved"));
              })
            }
          >
            {t("save")}
          </Button>
        )}
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setRewriting((v) => !v)}>
          <RefreshCw /> {t("rewrite")}
        </Button>
        {mailto && (
          <Button size="sm" variant="ghost" render={<a href={mailto} />} nativeButton={false}>
            <Mail /> {t("openInMail")}
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            await copyMessage(isEmail && subject ? `${subject}\n\n${body}` : body, isEmail ? f.share : null);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? <Check /> : <Copy />} {t("copy")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() => run(async () => toastResult(await markFollowupSentByMe(f.id), t("markedSent")))}
        >
          {t("sentMyself")}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              await cancelFollowup(f.id);
              toast.success(t("cancelled"));
            })
          }
        >
          {t("cancel")}
        </Button>
      </div>
    </div>
  );
}
