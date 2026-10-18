"use client";

import {
  CalendarDays,
  Check,
  Download,
  Forward,
  MessageCircleQuestion,
  MessageSquareText,
  MoreHorizontal,
  Receipt,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { DealStatus } from "@/generated/prisma/enums";
import type { BookingTarget } from "@/lib/closing/booking/url";
import { SIGNER_NAME } from "@/lib/closing/i18n/signed-email";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";
import { cn } from "@/lib/utils";

import { BookingDialog } from "./booking-dialog";
import { BAR_HEIGHT_VAR, STRIP_CELL, STRIP_ICON_CELL } from "./decision-strip";
import { ForwardDialog, type ForwardOptions } from "./forward-dialog";
import { sendSignal } from "./view-signal";

type Props = {
  slug: string;
  labels: ViewerLabels;
  initialStatus: DealStatus;
  getViewId: () => string | null;
  documentName: string;
  /** The reader reached the pricing or last page: the strip opens up and asks for an answer. */
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
  /** The assistant is on: "Une question ?" opens its panel from the bar. */
  onAskQuestion?: () => void;
  /** The voice note button, when the prospect may leave one and no sheet is open. */
  voice?: React.ReactNode;
  /** "Transférer" to a colleague, null when not offered. */
  forward?: ForwardOptions | null;
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
  onAskQuestion,
  voice,
  forward = null,
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
  const [forwardOpen, setForwardOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  usePublishedHeight(barRef);

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
  // Past the pricing or last page the strip opens up: the question is asked plainly
  const expanded = atEnd && !done;
  const notice = booked
    ? labels.meetingBooked
    : quoteSent
      ? labels.quoteRequested
      : status === "CHANGE_REQUESTED"
        ? labels.changeRequested
        : null;
  // The one ink cell: sign, or ask for a quote, or book when nothing else is offered
  const bookingIsPrimary = !!booking && !(answers || (quote && !quoteSent));
  const primaryCell = cn(
    STRIP_CELL,
    "flex-1 gap-2 bg-primary px-4 text-body font-semibold text-primary-foreground hover:bg-primary/85 focus-visible:ring-primary-foreground sm:flex-none sm:px-6",
    expanded && "max-sm:order-1 max-sm:min-h-14 max-sm:basis-full sm:min-h-14",
  );
  const secondaryCell = cn(
    STRIP_CELL,
    "gap-2",
    expanded
      ? "flex-1 px-3 max-sm:order-2 sm:min-h-14 sm:flex-none sm:px-5"
      : cn(STRIP_ICON_CELL, "sm:w-auto sm:px-4"),
  );
  const toolCell = cn(STRIP_CELL, STRIP_ICON_CELL, "gap-2", expanded && "max-sm:order-2 sm:min-h-14");
  // Small screens, folded strip: the side actions go under one labelled "Plus", the answer keeps the room
  const folded = !expanded;
  const inMenu = folded && "max-sm:hidden";
  const forwardButton = (className: string) =>
    forward && (
      <ForwardDialog
        {...forward}
        slug={slug}
        labels={labels}
        documentName={documentName}
        getViewId={getViewId}
        className={className}
        open={forwardOpen}
        onOpenChange={setForwardOpen}
      />
    );
  const moreMenu = (items: MoreItem[]) =>
    items.length > 0 && (
      <MoreMenu label={labels.moreActions} items={items} className={cn(STRIP_CELL, "gap-2 px-4 sm:hidden")} />
    );
  const chatItem: MoreItem[] = onAskQuestion
    ? [{ key: "chat", icon: MessageCircleQuestion, label: labels.chatAsk, onSelect: onAskQuestion }]
    : [];
  const bookingItem: MoreItem[] = booking
    ? [{ key: "booking", icon: CalendarDays, label: labels.bookMeeting, onSelect: openBooking }]
    : [];
  const forwardItem: MoreItem[] = forward
    ? [{ key: "forward", icon: Forward, label: labels.forwardButton, onSelect: () => setForwardOpen(true) }]
    : [];

  return (
    <>
      <div
        ref={barRef}
        role="region"
        aria-label={labels.readyPrompt}
        className="fixed inset-x-0 bottom-0 z-20 border-t border-foreground bg-card pr-[env(safe-area-inset-right)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)]"
      >
        <div className="mx-auto max-w-[54rem] sm:border-x sm:border-border">
          {done ? (
            <div className="flex items-stretch gap-px bg-border">
              <div role="status" className="flex min-h-14 flex-1 items-center gap-3 bg-card px-4 py-2.5">
                <span className="flex size-8 shrink-0 animate-pop items-center justify-center rounded-sm bg-success text-success-foreground">
                  <Check className="size-4.5" strokeWidth={2.5} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-body font-semibold">{labels.validated}</p>
                  <p className="text-small text-muted-foreground">
                    {receipt ? labels.signedReceipt : labels.validatedNext}
                  </p>
                </div>
              </div>
              {/* Signed: still a question to ask or a meeting to book, and the moment it goes to finance or legal */}
              {moreMenu([...chatItem, ...bookingItem, ...forwardItem])}
              {onAskQuestion && (
                <Button
                  variant="ghost"
                  className={cn(STRIP_CELL, "w-14 gap-2 max-sm:hidden md:w-auto md:px-5")}
                  aria-label={labels.chatAsk}
                  onClick={onAskQuestion}
                  data-chat-trigger
                >
                  <MessageCircleQuestion />
                  <span className="hidden md:inline">{labels.chatAsk}</span>
                </Button>
              )}
              {booking && (
                <Button
                  variant="ghost"
                  className={cn(STRIP_CELL, "w-14 gap-2 max-sm:hidden md:w-auto md:px-5")}
                  aria-label={labels.bookMeeting}
                  onClick={openBooking}
                >
                  <CalendarDays />
                  <span className="hidden md:inline">{labels.bookMeeting}</span>
                </Button>
              )}
              {forwardButton(cn(STRIP_CELL, "w-14 gap-2 max-sm:hidden md:w-auto md:px-5"))}
              {downloadUrl && (
                <Button
                  variant="ghost"
                  className={cn(STRIP_CELL, "w-14 gap-2 sm:w-auto sm:px-5")}
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
            <div className="flex flex-wrap items-stretch gap-px bg-border sm:flex-nowrap">
              <p
                role="status"
                className={cn(
                  "items-center bg-card px-4",
                  expanded
                    ? "flex basis-full py-2.5 text-body font-semibold text-foreground sm:flex-1 sm:basis-auto sm:py-0"
                    : notice
                      ? "flex basis-full py-2 text-small text-muted-foreground sm:flex-1 sm:basis-auto sm:py-0"
                      : "hidden text-small text-muted-foreground sm:flex sm:flex-1",
                )}
              >
                {notice ?? labels.readyPrompt}
              </p>
              {moreMenu(
                folded
                  ? [
                      ...chatItem,
                      ...(bookingIsPrimary ? [] : bookingItem),
                      ...forwardItem,
                      ...(answers
                        ? [{
                            key: "change",
                            icon: MessageSquareText,
                            label: labels.requestChange,
                            onSelect: () => setDialog("change"),
                            disabled: pending,
                          }]
                        : []),
                    ]
                  : [],
              )}
              {onAskQuestion && (
                <Button
                  variant="ghost"
                  className={cn(toolCell, inMenu, "md:w-auto md:px-4")}
                  aria-label={labels.chatAsk}
                  onClick={onAskQuestion}
                  data-chat-trigger
                >
                  <MessageCircleQuestion />
                  <span className="hidden md:inline">{labels.chatAsk}</span>
                </Button>
              )}
              {voice && <div className={cn("flex", expanded && "max-sm:order-2")}>{voice}</div>}
              {forwardButton(cn(toolCell, inMenu, "md:w-auto md:px-4"))}
              {booking &&
                (bookingIsPrimary ? (
                  <Button className={primaryCell} onClick={openBooking}>
                    <CalendarDays aria-hidden />
                    <span className="truncate">{labels.bookMeeting}</span>
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    className={cn(secondaryCell, inMenu)}
                    aria-label={labels.bookMeeting}
                    onClick={openBooking}
                    disabled={pending}
                  >
                    <CalendarDays />
                    <span className={cn(!expanded && "hidden sm:inline", "truncate")}>{labels.bookMeeting}</span>
                  </Button>
                ))}
              {quote && !quoteSent && (
                <Button className={primaryCell} onClick={() => setDialog("quote")} disabled={pending}>
                  <Receipt aria-hidden />
                  <span className="truncate">{labels.requestQuote}</span>
                </Button>
              )}
              {answers && (
                <>
                  <Button
                    variant="ghost"
                    className={cn(secondaryCell, inMenu)}
                    aria-label={labels.requestChange}
                    onClick={() => setDialog("change")}
                    disabled={pending}
                  >
                    <MessageSquareText />
                    <span className={cn(!expanded && "hidden sm:inline", "truncate")}>{labels.requestChange}</span>
                  </Button>
                  <Button className={primaryCell} onClick={() => setDialog("validate")} disabled={pending}>
                    <Check aria-hidden />
                    <span className="truncate">{labels.validate}</span>
                  </Button>
                </>
              )}
            </div>
          )}
          {error && !dialog && (
            <p role="alert" className="border-t border-border px-4 py-2 text-small text-destructive">
              {labels.actionError}
            </p>
          )}
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
        <DialogContent showCloseButton={false} className="rounded-lg ring-foreground/85 sm:max-w-md">
          {dialog === "validate" ? (
            <>
              <DialogHeader>
                <DialogTitle className="text-heading">{labels.confirmTitle}</DialogTitle>
                <DialogDescription>{documentName}</DialogDescription>
              </DialogHeader>
              <p className="text-body text-muted-foreground">{labels.confirmHint}</p>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signer-name">{labels.signName}</Label>
                  <Input
                    id="signer-name"
                    autoComplete="name"
                    autoFocus
                    className="h-11 caret-foreground"
                    value={name}
                    maxLength={80}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <label className="flex cursor-pointer items-start gap-2.5 text-body">
                  <Checkbox className="mt-1 rounded-sm" checked={agreed} onCheckedChange={(checked) => setAgreed(checked === true)} />
                  <span>{labels.signAgree}</span>
                </label>
              </div>
              {error && <p role="alert" className="text-small text-destructive">{labels.actionError}</p>}
              <DialogFooter>
                <DialogClose render={<Button variant="ghost" disabled={pending} />}>{labels.cancel}</DialogClose>
                <Button
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
                className="rounded-md caret-foreground"
                value={message}
                placeholder={labels.quotePlaceholder}
                aria-label={labels.quoteTitle}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error && <p role="alert" className="text-small text-destructive">{labels.actionError}</p>}
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
                className="rounded-md caret-foreground"
                value={message}
                placeholder={labels.changePlaceholder}
                aria-label={labels.changeTitle}
                onChange={(e) => setMessage(e.target.value)}
              />
              {error && <p role="alert" className="text-small text-destructive">{labels.actionError}</p>}
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

type MoreItem = { key: string; icon: LucideIcon; label: string; onSelect: () => void; disabled?: boolean };

/** "Plus" on small screens: the side actions, each with its words, instead of a row of bare icons. */
function MoreMenu({ label, items, className }: { label: string; items: MoreItem[]; className: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" className={className} data-chat-trigger />}>
        <MoreHorizontal aria-hidden />
        {label}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-auto min-w-56">
        {items.map(({ key, icon: Icon, label: text, onSelect, disabled }) => (
          <DropdownMenuItem key={key} className="min-h-11 gap-2.5" onClick={onSelect} disabled={disabled}>
            <Icon aria-hidden />
            {text}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Writes the strip's height on <html> while it is on screen: the page and the floating pieces keep clear of it. */
function usePublishedHeight(ref: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty(BAR_HEIGHT_VAR, `${element.offsetHeight}px`));
    observer.observe(element);
    return () => {
      observer.disconnect();
      root.style.removeProperty(BAR_HEIGHT_VAR);
    };
  }, [ref]);
}
