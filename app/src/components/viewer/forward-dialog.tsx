"use client";

import { Check, Eye, Forward } from "lucide-react";
import { useState, useTransition } from "react";

import { submitForward, type ForwardResult } from "@/app/v/[slug]/forward";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FORWARD_MESSAGE_MAX } from "@/lib/closing/forward/limits";
import { containsLink } from "@/lib/closing/forward/rules";
import { fillLabel, type ViewerLabels } from "@/lib/closing/i18n/viewer";

/** What the page knows to offer "Transférer": null when it is not offered. */
export type ForwardOptions = {
  senderName: string;
  /** The reader never gave their email: the dialog asks for it, the email goes out in their name. */
  needsEmail: boolean;
};

type Props = ForwardOptions & {
  slug: string;
  labels: ViewerLabels;
  documentName: string;
  getViewId: () => string | null;
  /** The strip cell the trigger sits in. */
  className: string;
  /** The label next to the icon; hidden on small screens otherwise. */
  showLabel?: boolean;
  /** Opened from elsewhere too (the bar's "Plus" menu on small screens). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

type Failure = Extract<ForwardResult, { ok: false }>["error"];

function errorText(error: Failure, labels: ViewerLabels, sender: string) {
  switch (error) {
    case "self":
      return labels.forwardErrorSelf;
    case "seller":
      return fillLabel(labels.forwardErrorSeller, { sender });
    case "unavailable":
      return labels.forwardErrorUnavailable;
    case "invalid_email":
    case "identify":
      return labels.invalidEmail;
    case "invalid_name":
      return labels.forwardErrorName;
    case "invalid_message":
      return labels.forwardErrorLink;
    case "limit":
      return labels.forwardErrorLimit;
    default:
      return labels.forwardError;
  }
}

/** "Transférer": the reader sends the document to a colleague, in their name. */
export function ForwardDialog({
  slug,
  labels,
  documentName,
  getViewId,
  senderName,
  needsEmail,
  className,
  showLabel = false,
  open: openProp,
  onOpenChange,
}: Props) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = openProp ?? ownOpen;
  const setOpen = onOpenChange ?? setOwnOpen;
  const [to, setTo] = useState("");
  const [toName, setToName] = useState("");
  const [message, setMessage] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [fromName, setFromName] = useState("");
  const [notifyOnOpen, setNotifyOnOpen] = useState(false);
  // Identified by the first send: the next ones need no email of their own
  const [identified, setIdentified] = useState(!needsEmail);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<Failure | null>(null);
  const [pending, startTransition] = useTransition();

  const linkInMessage = containsLink(message);

  function reset() {
    setTo("");
    setToName("");
    setMessage("");
    setNotifyOnOpen(false);
    setSentTo(null);
    setError(null);
  }

  function send() {
    setError(null);
    startTransition(async () => {
      const result = await submitForward({
        slug,
        viewId: getViewId(),
        to,
        toName,
        message,
        fromEmail: identified ? null : fromEmail,
        fromName: identified ? null : fromName,
        notifyOnOpen,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setIdentified(true);
      setSentTo(to.trim().toLowerCase());
    });
  }

  return (
    <>
      <Button variant="ghost" className={className} aria-label={labels.forwardButton} onClick={() => setOpen(true)}>
        <Forward />
        <span className={showLabel ? "truncate" : "hidden md:inline"}>{labels.forwardButton}</span>
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (pending) return;
          setOpen(next);
          if (!next && sentTo) reset();
        }}
      >
        <DialogContent showCloseButton={false} className="rounded-lg ring-foreground/85 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-heading">{labels.forwardTitle}</DialogTitle>
            <DialogDescription>{documentName}</DialogDescription>
          </DialogHeader>

          {sentTo ? (
            <>
              <p role="status" className="flex items-center gap-2.5 text-body">
                <span className="flex size-7 shrink-0 animate-pop items-center justify-center rounded-sm bg-success text-success-foreground">
                  <Check className="size-4" strokeWidth={2.5} aria-hidden />
                </span>
                {fillLabel(labels.forwardSent, { email: sentTo })}
              </p>
              <DialogFooter>
                <Button variant="ghost" onClick={reset}>
                  {labels.forwardAnother}
                </Button>
                <DialogClose render={<Button />}>{labels.chatClose}</DialogClose>
              </DialogFooter>
            </>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                send();
              }}
            >
              <p className="text-small text-muted-foreground">{labels.forwardDescription}</p>
              {!identified && (
                <div className="grid gap-3 rounded-md bg-muted/60 p-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="forward-from-email">{labels.forwardFromEmail}</Label>
                    <Input
                      id="forward-from-email"
                      type="email"
                      required
                      autoComplete="email"
                      className="h-11 caret-foreground"
                      value={fromEmail}
                      maxLength={254}
                      onChange={(e) => setFromEmail(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="forward-from-name">{labels.forwardFromName}</Label>
                    <Input
                      id="forward-from-name"
                      autoComplete="name"
                      className="h-11 caret-foreground"
                      value={fromName}
                      maxLength={80}
                      onChange={(e) => setFromName(e.target.value)}
                    />
                  </div>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="forward-to">{labels.forwardToEmail}</Label>
                <Input
                  id="forward-to"
                  type="email"
                  required
                  autoFocus={identified}
                  autoComplete="off"
                  className="h-11 caret-foreground"
                  value={to}
                  maxLength={254}
                  onChange={(e) => setTo(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forward-to-name">{labels.forwardToName}</Label>
                <Input
                  id="forward-to-name"
                  autoComplete="off"
                  className="h-11 caret-foreground"
                  value={toName}
                  maxLength={80}
                  onChange={(e) => setToName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="forward-message">{labels.forwardMessage}</Label>
                <Textarea
                  id="forward-message"
                  rows={3}
                  className="rounded-md caret-foreground"
                  value={message}
                  maxLength={FORWARD_MESSAGE_MAX}
                  aria-describedby="forward-message-notice"
                  onChange={(e) => setMessage(e.target.value)}
                />
                <p id="forward-message-notice" className="flex items-center gap-1.5 text-small text-muted-foreground">
                  <Eye className="size-3.5 shrink-0" aria-hidden />
                  {fillLabel(labels.forwardMessageNotice, { sender: senderName })}
                </p>
              </div>
              <label className="flex cursor-pointer items-start gap-2.5 text-body">
                <Checkbox
                  className="mt-1 rounded-sm"
                  checked={notifyOnOpen}
                  onCheckedChange={(checked) => setNotifyOnOpen(checked === true)}
                />
                <span>{labels.forwardNotifyOpen}</span>
              </label>
              {(error || linkInMessage) && (
                <p role="alert" className="text-small text-destructive">
                  {linkInMessage ? labels.forwardErrorLink : errorText(error!, labels, senderName)}
                </p>
              )}
              <DialogFooter>
                <DialogClose render={<Button type="button" variant="ghost" disabled={pending} />}>{labels.cancel}</DialogClose>
                <Button type="submit" disabled={pending || !to.trim() || linkInMessage}>
                  <Forward data-icon="inline-start" />
                  {labels.forwardSend}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
