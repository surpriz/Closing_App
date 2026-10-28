"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type ActionResult,
  pauseEnrollmentAction,
  removeEnrollmentAction,
  resumeEnrollmentAction,
} from "@/app/(dashboard)/campaigns/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UiLocale } from "@/i18n/locale";
import { formatInTimeZone } from "@/lib/format";

type EnrollmentStatus =
  | "QUEUED"
  | "ACTIVE"
  | "PAUSED"
  | "REPLIED"
  | "BOUNCED"
  | "UNSUBSCRIBED"
  | "SUPPRESSED"
  | "FINISHED"
  | "STOPPED";

export type EnrollmentRow = {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  status: EnrollmentStatus;
  pausedReason: string | null;
  currentStep: number;
  timezone: string;
  nextAt: Date | null;
  lastAt: Date | null;
  linkId: string | null;
};

const STATUS_VARIANT = {
  QUEUED: "secondary",
  ACTIVE: "success",
  PAUSED: "warning",
  REPLIED: "info",
  BOUNCED: "destructive",
  UNSUBSCRIBED: "secondary",
  SUPPRESSED: "secondary",
  FINISHED: "info",
  STOPPED: "secondary",
} as const;

const KNOWN_REASONS = ["rejected", "send_failed", "plan_limit", "document_missing", "suppressed", "archived"] as const;
const REMOVABLE: EnrollmentStatus[] = ["QUEUED", "ACTIVE", "PAUSED"];

export function EnrollmentsTable({
  rows,
  totalSteps,
  locale,
  disabled,
  truncated,
}: {
  rows: EnrollmentRow[];
  totalSteps: number;
  locale: UiLocale;
  disabled: boolean;
  /** More prospects exist than the page loads. */
  truncated: boolean;
}) {
  const t = useTranslations("campaigns");
  const te = useTranslations("campaigns.enrollments");
  const [filter, setFilter] = useState<"all" | EnrollmentStatus>("all");
  const [removing, setRemoving] = useState<EnrollmentRow | null>(null);
  const [pending, startTransition] = useTransition();

  const present = (Object.keys(STATUS_VARIANT) as EnrollmentStatus[]).filter((status) =>
    rows.some((row) => row.status === status),
  );
  const visible = filter === "all" ? rows : rows.filter((row) => row.status === filter);

  const run = (action: (id: string) => Promise<ActionResult>, id: string, done?: () => void) =>
    startTransition(async () => {
      const result = await action(id);
      if ("error" in result) toast.error(result.error);
      else if (result.notice) toast.success(result.notice);
      done?.();
    });

  const reasonLabel = (row: EnrollmentRow) => {
    const reason = row.pausedReason;
    if (!reason) return null;
    if (reason.startsWith("missing_variable:")) return te("reasons.missingVariable", { name: reason.slice("missing_variable:".length) });
    if (reason === "seller") return row.status === "PAUSED" ? te("reasons.seller") : null;
    return (KNOWN_REASONS as readonly string[]).includes(reason) ? te(`reasons.${reason as (typeof KNOWN_REASONS)[number]}`) : null;
  };

  const when = (date: Date | null, row: EnrollmentRow) => (date ? formatInTimeZone(date, row.timezone, locale) : te("never"));

  if (rows.length === 0) return <p className="text-small text-muted-foreground">{te("empty")}</p>;

  return (
    <div className="space-y-3">
      {present.length > 1 && (
        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <TabsList variant="line" aria-label={te("filterLabel")} className="h-auto flex-wrap">
            <TabsTrigger value="all">
              {te("all")} · {rows.length}
            </TabsTrigger>
            {present.map((status) => (
              <TabsTrigger key={status} value={status}>
                {t(`enrollmentStatus.${status}`)} · {rows.filter((row) => row.status === status).length}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{te("columns.email")}</TableHead>
            <TableHead>{te("columns.status")}</TableHead>
            <TableHead>{te("columns.step")}</TableHead>
            <TableHead>{te("columns.next")}</TableHead>
            <TableHead>{te("columns.last")}</TableHead>
            <TableHead className="text-right">{te("columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => {
            const reason = reasonLabel(row);
            return (
              <TableRow key={row.id}>
                <TableCell className="max-w-64">
                  <p className="truncate font-medium">{row.email}</p>
                  {(row.name || row.company) && (
                    <p className="truncate text-small text-muted-foreground">
                      {[row.name, row.company].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]}>{t(`enrollmentStatus.${row.status}`)}</Badge>
                  {reason && <p className="mt-0.5 text-small text-muted-foreground">{reason}</p>}
                </TableCell>
                <TableCell className="tabular-nums">
                  {row.currentStep}/{totalSteps}
                </TableCell>
                <TableCell className="text-muted-foreground">{when(row.nextAt, row)}</TableCell>
                <TableCell className="text-muted-foreground">{when(row.lastAt, row)}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap justify-end gap-1">
                    {row.linkId && (
                      <Button variant="ghost" size="sm" render={<Link href={`/links/${row.linkId}`} />} nativeButton={false}>
                        {te("openLink")}
                      </Button>
                    )}
                    {!disabled && row.status === "ACTIVE" && (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(pauseEnrollmentAction, row.id)}>
                        {te("pause")}
                      </Button>
                    )}
                    {!disabled && row.status === "PAUSED" && (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(resumeEnrollmentAction, row.id)}>
                        {te("resume")}
                      </Button>
                    )}
                    {!disabled && REMOVABLE.includes(row.status) && (
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setRemoving(row)}>
                        {te("remove")}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {truncated && <p className="text-small text-muted-foreground">{te("truncated", { count: rows.length })}</p>}

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{te("removeTitle")}</DialogTitle>
            <DialogDescription>{te("removeDescription", { email: removing?.email ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setRemoving(null)}>
              {te("cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => removing && run(removeEnrollmentAction, removing.id, () => setRemoving(null))}
            >
              {te("removeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
