"use client";

import { CalendarDays, Check, Download, MessageSquareText, Receipt } from "lucide-react";
import { useState, useTransition } from "react";

import { recordMeetingBooked, recordMeetingClick, submitProspectAction } from "@/app/v/[slug]/actions";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DealStatus } from "@/generated/prisma/enums";
import type { BookingTarget } from "@/lib/closing/booking/url";
import { SIGNER_NAME } from "@/lib/closing/i18n/signed-email";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

import { BookingDialog } from "./booking-dialog";
import { sendSignal } from "./view-signal";

type Props = {
  slug: string;
  labels: ViewerLabels;
  initialStatus: DealStatus;
  getViewId: () => string | null;
  documentName: string;
  /** The reader reached the end: the bar asks for an answer. */
  atEnd?: boolean;
  /** Offered in the name field when signing. */
  signerName: string | null;
  /** PDF only: once signed, the prospect keeps a copy. */
  downloadUrl?: string;
  /** "Valider" and "Demander un ajustement" (Link.ctaEnabled). */
  answers: boolean;
  /** Video pitch: "Demander un devis" instead (Link.ctaEnabled), nothing to sign. */
  quote?: boolean;
  /** The seller's booking page, null when they have none or it is off on this link. */
  booking: BookingTarget | null;
};

export function CtaBar({
  slug,
  labels,
  initialStatus,
  getViewId,
  documentName,
  atEnd = false,
  signerName,
  downloadUrl,
  answers,
  quote = false,
  booking,
}: Props) {
  const [status, setStatus] = useState<DealStatus>(initialStatus);
  const [dialog, setDialog] = useState<"validate" | "change" | "quote" | null>(null);
  // A quote asked for leaves the deal open: remembered here, not in the status
  const [quoteSent, setQuoteSent] = useState(false);
  const [message, setMessage] = useState("");
  const [name, setName] = useState(signerName ?? "");
  const [agreed, setAgreed] = useState(false);
  const [receipt, setReceipt] = useState(false);
  const [error, setError] = useState(false);
  const [pending, startTransition] = useTransition();
  // Bumped on each opening: the booking frame remounts fresh
  const [bookingOpening, setBookingOpening] = useState(0);
  const [bookingOpen, setBookingOpen] = useState(false);
  const [booked, setBooked] = useState(false);

  function openBooking() {
    if (!booking) return;
    void recordMeetingClick({ slug, viewId: getViewId() });
    if (booking.mode === "tab") {
      window.open(booking.src, "_blank", "noopener,noreferrer");
      return;
    }
    setBookingOpening((n) => n + 1);
    setBookingOpen(true);
  }

  function onBooked(startTime: string | null) {
    setBooked(true);
    void recordMeetingBooked({ slug, viewId: getViewId(), startTime });
  }

  function submit(type: "VALIDATE_SIGN" | "REQUEST_CHANGE" | "REQUEST_QUOTE") {
    setError(false);
    startTransition(async () => {
      const result = await submitProspectAction({
        slug,
        viewId: getViewId(),
        type,
        message: type === "VALIDATE_SIGN" ? undefined : message,
        ...(type === "VALIDATE_SIGN" && { signerName: name, agreed }),
      });
      if (!result.ok) {
        setError(true);
        return;
      }
      setReceipt(!!result.receipt);
      if (type === "REQUEST_QUOTE") setQuoteSent(true);
      else setStatus(type === "VALIDATE_SIGN" ? "VALIDATED" : "CHANGE_REQUESTED");
      setDialog(null);
      setMessage("");
    });
  }

  const done = answers && (status === "VALIDATED" || status === "WON");

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
              <div className="min-w-0 flex-1" role="status">
                <p className="text-sm font-semibold">{labels.validated}</p>
                <p className="text-small text-muted-foreground">
                  {receipt ? labels.signedReceipt : labels.validatedNext}
                </p>
              </div>
              {downloadUrl && (
                <Button
                  variant="outline"
                  size="lg"
                  className="h-11 w-11 shrink-0 px-0 sm:w-auto sm:px-4"
                  aria-label={labels.download}
                  render={<a href={downloadUrl} onClick={() => sendSignal(getViewId(), "DOWNLOAD")} />}
                  nativeButton={false}
                >
                  <Download />
                  <span className="hidden sm:inline">{labels.download}</span>
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <p className="px-2 text-sm text-muted-foreground sm:mr-auto" role="status">
                {booked ? (
                  labels.meetingBooked
                ) : quoteSent ? (
                  labels.quoteRequested
                ) : status === "CHANGE_REQUESTED" ? (
                  labels.changeRequested
                ) : (
                  <span className={cn("hidden sm:inline", atEnd && "inline font-medium text-foreground")}>
                    {labels.readyPrompt}
                  </span>
                )}
              </p>
              <div className="flex gap-2">
                {booking &&
                  (answers || (quote && !quoteSent) ? (
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-11 w-11 px-0 sm:w-auto sm:px-4"
                      aria-label={labels.bookMeeting}
                      onClick={openBooking}
                      disabled={pending}
                    >
                      <CalendarDays />
                      <span className="hidden sm:inline">{labels.bookMeeting}</span>
                    </Button>
                  ) : (
                    // Alone in the bar: the main action
                    <Button size="lg" className="h-11 flex-1 sm:flex-none" onClick={openBooking}>
                      <CalendarDays data-icon="inline-start" />
                      <span className="truncate">{labels.bookMeeting}</span>
                    </Button>
                  ))}
                {quote && !quoteSent && (
                  <Button size="lg" className="h-11 flex-1 sm:flex-none" onClick={() => setDialog("quote")} disabled={pending}>
                    <Receipt data-icon="inline-start" />
                    <span className="truncate">{labels.requestQuote}</span>
                  </Button>
                )}
                {answers && (
                  <>
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
                    <Button
                      size="lg"
                      className="h-11 flex-1 sm:flex-none"
                      onClick={() => setDialog("validate")}
                      disabled={pending}
                    >
                      <Check data-icon="inline-start" />
                      <span className="truncate">{labels.validate}</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          )}
          {error && !dialog && <p className="px-2 pt-1 text-center text-sm text-destructive">{labels.actionError}</p>}
        </div>
      </div>

      {booking && booking.mode === "embed" && bookingOpening > 0 && (
        <BookingDialog
          key={bookingOpening}
          open={bookingOpen}
          onOpenChange={setBookingOpen}
          target={booking}
          labels={labels}
          onBooked={onBooked}
        />
      )}

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
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signer-name">{labels.signName}</Label>
                  <Input
                    id="signer-name"
                    autoComplete="name"
                    autoFocus
                    className="h-11"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 text-sm">
                  <Checkbox className="mt-0.5" checked={agreed} onCheckedChange={(checked) => setAgreed(checked === true)} />
                  <span>{labels.signAgree}</span>
                </label>
              </div>
              {error && <p className="text-sm text-destructive">{labels.actionError}</p>}
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" disabled={pending} />}>{labels.cancel}</DialogClose>
                <Button
                  variant="success"
                  onClick={() => submit("VALIDATE_SIGN")}
                  disabled={pending || !agreed || !SIGNER_NAME.test(name.trim())}
                >
                  <Check data-icon="inline-start" />
                  {labels.confirmAction}
                </Button>
              </DialogFooter>
            </>
          ) : dialog === "quote" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-heading">{labels.quoteTitle}</DialogTitle>
                <DialogDescription>{documentName}</DialogDescription>
              </DialogHeader>
              <Textarea
                autoFocus
                rows={4}
                value={message}
                placeholder={labels.quotePlaceholder}
                aria-label={labels.quoteTitle}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error && <p className="text-sm text-destructive">{labels.actionError}</p>}
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" disabled={pending} />}>{labels.cancel}</DialogClose>
                <Button onClick={() => submit("REQUEST_QUOTE")} disabled={pending}>
                  {labels.send}
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
