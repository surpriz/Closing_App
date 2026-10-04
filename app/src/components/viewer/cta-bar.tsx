"use client";

import { Check, MessageSquareText } from "lucide-react";
import { useState, useTransition } from "react";

import { submitProspectAction } from "@/app/v/[slug]/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { DealStatus } from "@/generated/prisma/enums";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

type Props = {
  slug: string;
  labels: ViewerLabels;
  initialStatus: DealStatus;
  getViewId: () => string | null;
  documentName: string;
  /** The reader reached the end: the bar asks for an answer. */
  atEnd?: boolean;
};

export function CtaBar({ slug, labels, initialStatus, getViewId, documentName, atEnd = false }: Props) {
  const [status, setStatus] = useState<DealStatus>(initialStatus);
  const [dialog, setDialog] = useState<"validate" | "change" | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(type: "VALIDATE_SIGN" | "REQUEST_CHANGE") {
    setError(false);
    startTransition(async () => {
      const result = await submitProspectAction({
        slug,
        viewId: getViewId(),
        type,
        message: type === "REQUEST_CHANGE" ? message : undefined,
      });
      if (!result.ok) {
        setError(true);
        return;
      }
      setStatus(type === "VALIDATE_SIGN" ? "VALIDATED" : "CHANGE_REQUESTED");
      setDialog(null);
      setMessage("");
    });
  }

  const done = status === "VALIDATED" || status === "WON";

  return (
    <>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div
          className={cn(
            "pointer-events-auto mx-auto max-w-2xl rounded-2xl bg-card/95 p-2 shadow-lg ring-1 ring-border backdrop-blur-md transition-shadow duration-300",
            atEnd && !done && "ring-brand/40",
          )}
        >
          {done ? (
            <div className="flex items-center gap-3 px-2 py-1.5">
              <span className="flex size-9 shrink-0 animate-pop items-center justify-center rounded-full bg-success text-success-foreground">
                <Check className="size-5" strokeWidth={2.5} aria-hidden />
              </span>
              <div className="min-w-0" role="status">
                <p className="text-sm font-semibold">{labels.validated}</p>
                <p className="text-small text-muted-foreground">{labels.validatedNext}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="px-2 text-sm text-muted-foreground sm:mr-auto" role="status">
                {status === "CHANGE_REQUESTED" ? (
                  labels.changeRequested
                ) : (
                  <span className={cn("hidden sm:inline", atEnd && "inline font-medium text-foreground")}>
                    {labels.readyPrompt}
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 w-11 px-0 sm:w-auto sm:px-4"
                  aria-label={labels.requestChange}
                  onClick={() => setDialog("change")}
                  disabled={pending}
                >
                  <MessageSquareText />
                  <span className="hidden sm:inline">{labels.requestChange}</span>
                </Button>
                <Button size="lg" className="h-11 flex-1 sm:flex-none" onClick={() => setDialog("validate")} disabled={pending}>
                  <Check data-icon="inline-start" />
                  <span className="truncate">{labels.validate}</span>
                </Button>
              </div>
            </div>
          )}
          {error && !dialog && <p className="px-2 pt-1 text-center text-sm text-destructive">{labels.actionError}</p>}
        </div>
      </div>

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && !pending && setDialog(null)}>
        <DialogContent showCloseButton={false} className="sm:max-w-md">
          {dialog === "validate" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-heading">{labels.confirmTitle}</DialogTitle>
                <DialogDescription>
                  <span className="font-medium text-foreground">{documentName}</span>
                  <br />
                  {labels.confirmValidate}
                </DialogDescription>
              </DialogHeader>
              {error && <p className="text-sm text-destructive">{labels.actionError}</p>}
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" disabled={pending} />}>{labels.cancel}</DialogClose>
                <Button variant="success" onClick={() => submit("VALIDATE_SIGN")} disabled={pending}>
                  <Check data-icon="inline-start" />
                  {labels.confirmAction}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="text-heading">{labels.changeTitle}</DialogTitle>
                <DialogDescription>{documentName}</DialogDescription>
              </DialogHeader>
              <Textarea
                autoFocus
                rows={4}
                value={message}
                placeholder={labels.changePlaceholder}
                aria-label={labels.changeTitle}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{labels.actionError}</p>}
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" disabled={pending} />}>{labels.cancel}</DialogClose>
                <Button onClick={() => submit("REQUEST_CHANGE")} disabled={pending || message.trim().length === 0}>
                  {labels.send}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
