"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  activateCampaignAction,
  archiveCampaignAction,
  pauseCampaignAction,
} from "@/app/(dashboard)/campaigns/actions";
import { PageHeader, StatLine } from "@/components/dashboard/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export type CampaignStatus = "DRAFT" | "ACTIVE" | "PAUSED" | "DONE" | "ARCHIVED";

export type CampaignCounts = { enrolled: number; sent: number; replied: number; bounced: number; unsubscribed: number };

const STATUS_VARIANT = {
  DRAFT: "secondary",
  ACTIVE: "success",
  PAUSED: "warning",
  DONE: "info",
  ARCHIVED: "secondary",
} as const;

export function CampaignHeader({
  id,
  name,
  status,
  counts,
  canEdit,
}: {
  id: string;
  name: string;
  status: CampaignStatus;
  counts: CampaignCounts;
  /** The viewer created the campaign or manages the workspace. */
  canEdit: boolean;
}) {
  const t = useTranslations("campaigns");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const run = (action: (id: string) => Promise<{ ok: true; notice?: string } | { error: string }>, done?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action(id);
      if ("error" in result) {
        // Kept on screen: an activation refusal says what to fix, a toast would vanish before it is read
        setError(result.error);
        done?.();
        return;
      }
      if (result.notice) toast.success(result.notice);
      done?.();
    });

  // DONE too: prospects imported into a finished campaign restart it
  const canActivate = canEdit && (status === "DRAFT" || status === "PAUSED" || status === "DONE");

  return (
    <div className="space-y-4">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-1.5 text-small text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" aria-hidden />
        {t("header.back")}
      </Link>
      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-3">
            <span className="break-words">{name}</span>
            <Badge variant={STATUS_VARIANT[status]}>{t(`status.${status}`)}</Badge>
          </span>
        }
        action={
          <>
            {canActivate && (
              <Button disabled={pending} onClick={() => run(activateCampaignAction)}>
                {pending ? t("header.activating") : t("header.activate")}
              </Button>
            )}
            {canEdit && status === "ACTIVE" && (
              <Button variant="outline" disabled={pending} onClick={() => run(pauseCampaignAction)}>
                {pending ? t("header.pausing") : t("header.pause")}
              </Button>
            )}
            {canEdit && status !== "ARCHIVED" && (
              <Button variant="ghost" disabled={pending} onClick={() => setArchiving(true)}>
                {t("header.archive")}
              </Button>
            )}
          </>
        }
      />
      {error && (
        <p role="alert" className="text-small text-destructive">
          {error}
        </p>
      )}
      <StatLine
        items={[
          { value: counts.enrolled, label: t("header.stats.enrolled") },
          { value: counts.sent, label: t("header.stats.sent") },
          { value: counts.replied, label: t("header.stats.replied") },
          { value: counts.bounced, label: t("header.stats.bounced") },
          { value: counts.unsubscribed, label: t("header.stats.unsubscribed") },
        ]}
      />

      <Dialog open={archiving} onOpenChange={setArchiving}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("header.archiveTitle")}</DialogTitle>
            <DialogDescription>{t("header.archiveDescription")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setArchiving(false)}>
              {t("header.cancel")}
            </Button>
            <Button variant="destructive" disabled={pending} onClick={() => run(archiveCampaignAction, () => setArchiving(false))}>
              {t("header.archiveConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
