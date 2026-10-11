"use client";

import { ExternalLink } from "lucide-react";
import { useEffect, useEffectEvent, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CAL_PARENT_READY, parseBookingMessage } from "@/lib/closing/booking/messages";
import type { BookingTarget } from "@/lib/closing/booking/url";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

/** A widget that has not said hello by then is not coming: offer the page in a tab. */
const LOAD_TIMEOUT_MS = 8_000;
const DEFAULT_HEIGHT = 680;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: BookingTarget;
  labels: ViewerLabels;
  /** The widget confirmed a booking, once per opening. */
  onBooked: (startTime: string | null) => void;
};

/**
 * Calendly or Cal.com framed in the viewer, listening for the booking it
 * confirms. Remount it (key) for each opening: the frame starts fresh.
 */
export function BookingDialog({ open, onOpenChange, target, labels, onBooked }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "failed">("loading");
  const [height, setHeight] = useState<number | null>(null);
  const reportBooked = useEffectEvent((startTime: string | null) => onBooked(startTime));

  useEffect(() => {
    if (!open) return;
    let booked = false;
    const timer = window.setTimeout(() => setState((s) => (s === "loading" ? "failed" : s)), LOAD_TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      const frame = frameRef.current?.contentWindow;
      // Our own frame only, and only from the provider's origins (parseBookingMessage)
      if (!frame || event.source !== frame) return;
      const message = parseBookingMessage({ origin: event.origin, data: event.data }, target.provider);
      if (!message) return;
      switch (message.kind) {
        case "cal_handshake":
          frame.postMessage(CAL_PARENT_READY, event.origin);
          break;
        case "loaded":
          setState("ready");
          break;
        case "failed":
          setState("failed");
          break;
        case "resize":
          setHeight(message.height);
          break;
        case "booked":
          if (booked) return;
          booked = true;
          reportBooked(message.startTime);
          break;
      }
    }

    window.addEventListener("message", onMessage);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("message", onMessage);
    };
  }, [open, target.provider]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="px-5 pt-5 pb-3">
          <DialogTitle className="text-heading">{labels.bookingTitle}</DialogTitle>
        </DialogHeader>
        {state === "failed" ? (
          <div className="space-y-3 px-5 pb-6 text-sm">
            <p className="text-muted-foreground">{labels.bookingFallback}</p>
            <Button
              variant="outline"
              render={<a href={target.tabSrc} target="_blank" rel="noopener noreferrer" />}
              nativeButton={false}
            >
              <ExternalLink data-icon="inline-start" />
              {labels.bookingOpenTab}
            </Button>
          </div>
        ) : (
          <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto">
            <iframe
              ref={frameRef}
              src={target.src}
              title={labels.bookingTitle}
              className="block w-full border-0"
              style={{ height: height ?? DEFAULT_HEIGHT }}
              allow="payment; clipboard-write"
              referrerPolicy="strict-origin-when-cross-origin"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
