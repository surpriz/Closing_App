"use client";

import { Ellipsis } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  type ActionResult,
  pauseEnrollmentAction,
  removeEnrollmentAction,
  resendStepAction,
  resumeEnrollmentAction,
  skipStepAction,
} from "@/app/(dashboard)/campaigns/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { UiLocale } from "@/i18n/locale";

import { enrollmentActions } from "./enrollment-actions";
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
  lastSignal: string | null;
  reactivatedAt: Date | null;
  followup: { status: string; at: Date | null } | null;
  clicked: boolean;
  /** The next step was interrupted mid-send: FAILED with a Message-ID, so the mail may have left. */
  blockedStep: boolean;
};

// Achromatic: the only colour on this screen is a send error (DESIGN.md, chrome stays graphite)
const STATUS_VARIANT = {
  QUEUED: "secondary",
  ACTIVE: "info",
  PAUSED: "outline",
  REPLIED: "info",
  BOUNCED: "destructive",
  UNSUBSCRIBED: "secondary",
  SUPPRESSED: "secondary",
  FINISHED: "secondary",
  STOPPED: "secondary",
} as const;

const KNOWN_REASONS = ["rejected", "send_failed", "plan_limit", "document_missing", "suppressed", "archived", "interrupted"] as const;
// The reading signals the evaluator writes; a reactivation is told by reactivatedAt, never by lastSignal
const SIGNALS = ["pricing", "deep"] as const;
const CALL_REASONS = ["call_moment", "deep_read"];

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
  const [resuming, setResuming] = useState<EnrollmentRow | null>(null);
  const [resending, setResending] = useState<EnrollmentRow | null>(null);
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
    // Paused for a call: the signal column says so, the status says what waits on the seller
    if (CALL_REASONS.includes(reason)) return row.status === "PAUSED" ? te("reasons.callMoment") : null;
    return (KNOWN_REASONS as readonly string[]).includes(reason) ? te(`reasons.${reason as (typeof KNOWN_REASONS)[number]}`) : null;
  };

  const when = (date: Date | null, row: EnrollmentRow) => (date ? formatInTimeZone(date, row.timezone, locale) : te("never"));

  // The reactivation comes last in a sequence: once there, it is the latest news about the prospect
  const signalLabel = (row: EnrollmentRow) => {
    if (row.reactivatedAt) return te("signals.reactivated");
    return row.lastSignal && (SIGNALS as readonly string[]).includes(row.lastSignal)
      ? te(`signals.${row.lastSignal as (typeof SIGNALS)[number]}`)
      : null;
  };

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
            <TableHead>{te("columns.signal")}</TableHead>
            <TableHead>{te("columns.followup")}</TableHead>
            <TableHead>{te("columns.next")}</TableHead>
            <TableHead>{te("columns.last")}</TableHead>
            <TableHead className="text-right">{te("columns.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {visible.map((row) => {
            const reason = reasonLabel(row);
            const actions = enrollmentActions(row, disabled);
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
                  {row.clicked && <p className="text-small text-muted-foreground">{te("clicked")}</p>}
                  {row.status === "ACTIVE" && row.blockedStep && (
                    <p className="mt-0.5 text-small font-medium text-warning-foreground">
                      {te("blocked", { step: row.currentStep + 1 })}
                    </p>
                  )}
                </TableCell>
                <TableCell>
                  {signalLabel(row) ?? <span className="text-muted-foreground">{te("noSignal")}</span>}
                  {row.status === "PAUSED" && row.pausedReason && CALL_REASONS.includes(row.pausedReason) && (
                    <p className="mt-0.5 text-small font-medium">
                      {row.linkId ? (
                        <Link href={`/links/${row.linkId}`} className="underline underline-offset-2">
                          {te("callThem")}
                        </Link>
                      ) : (
                        te("callThem")
                      )}
                    </p>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.followup?.status === "PENDING" && te("followup.pending")}
                  {row.followup?.status === "DRAFT" && (
                    <Link href={row.linkId ? `/links/${row.linkId}#relances` : "/drafts"} className="underline underline-offset-2">
                      {te("followup.draft")}
                    </Link>
                  )}
                  {(row.followup?.status === "GENERATED" || row.followup?.status === "SCHEDULED") &&
                    te("followup.scheduled", { date: when(row.followup.at, row) })}
                  {row.followup?.status === "SENT" && te("followup.sent", { date: when(row.followup.at, row) })}
                  {!row.followup && te("noSignal")}
                </TableCell>
                <TableCell className="text-muted-foreground">{when(row.nextAt, row)}</TableCell>
                <TableCell className="text-muted-foreground">{when(row.lastAt, row)}</TableCell>
                <TableCell className="text-right">
                  {/* Every action of the row, behind one quiet button (D8); no button when there is nothing to offer */}
                  {actions.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        aria-label={te("actionsMenu", { email: row.email })}
                        className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/30 aria-expanded:bg-muted aria-expanded:text-foreground"
                      >
                        <Ellipsis className="size-4" aria-hidden />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-56">
                        {actions.includes("openLink") && (
                          <DropdownMenuItem render={<Link href={`/links/${row.linkId}`} />}>{te("openLink")}</DropdownMenuItem>
                        )}
                        {actions.includes("resendStep") && (
                          <DropdownMenuItem disabled={pending} onClick={() => setResending(row)}>
                            {te("resendStep")}
                          </DropdownMenuItem>
                        )}
                        {actions.includes("skipStep") && (
                          <DropdownMenuItem disabled={pending} onClick={() => run(skipStepAction, row.id)}>
                            {te("skipStep")}
                          </DropdownMenuItem>
                        )}
                        {actions.includes("pause") && (
                          <DropdownMenuItem disabled={pending} onClick={() => run(pauseEnrollmentAction, row.id)}>
                            {te("pause")}
                          </DropdownMenuItem>
                        )}
                        {actions.includes("resume") && (
                          <DropdownMenuItem
                            disabled={pending}
                            onClick={() => (row.pausedReason === "interrupted" ? setResuming(row) : run(resumeEnrollmentAction, row.id))}
                          >
                            {te("resume")}
                          </DropdownMenuItem>
                        )}
                        {actions.includes("remove") && (
                          <>
                            {actions.length > 1 && <DropdownMenuSeparator />}
                            <DropdownMenuItem variant="destructive" disabled={pending} onClick={() => setRemoving(row)}>
                              {te("remove")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {truncated && <p className="text-small text-muted-foreground">{te("truncated", { count: rows.length })}</p>}

      {/* An interrupted send may have left the mail: the seller checks before it can go out a second time */}
      <Dialog open={resuming !== null} onOpenChange={(open) => !open && setResuming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{te("resumeTitle")}</DialogTitle>
            <DialogDescription>{te("resumeInterrupted", { email: resuming?.email ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setResuming(null)}>
              {te("cancel")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => resuming && run(resumeEnrollmentAction, resuming.id, () => setResuming(null))}
            >
              {te("resumeConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={resending !== null} onOpenChange={(open) => !open && setResending(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{te("resendTitle")}</DialogTitle>
            <DialogDescription>{te("resendDescription", { email: resending?.email ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" disabled={pending} onClick={() => setResending(null)}>
              {te("cancel")}
            </Button>
            <Button
              disabled={pending}
              onClick={() => resending && run(resendStepAction, resending.id, () => setResending(null))}
            >
              {te("resendConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
