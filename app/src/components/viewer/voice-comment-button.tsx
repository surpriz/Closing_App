"use client";

import { Check, Mic, RotateCcw, Square, X } from "lucide-react";
import { useState } from "react";

import { useMediaRecorder } from "@/components/media/use-media-recorder";
import { Button } from "@/components/ui/button";
import { fillLabel, type ViewerLabels } from "@/lib/closing/i18n/viewer";
import { VOICE_COMMENT_MAX_MS } from "@/lib/closing/media/limits";
import { baseMime } from "@/lib/closing/media/mime";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  pageNumber: number;
  labels: ViewerLabels;
  senderName: string | null;
  getViewId: () => string | null;
};

type SendState = "idle" | "sending" | "sent" | "error" | "limit";

/** A mic on the page on screen: the prospect records a question, the seller gets it with its transcript. */
export function VoiceCommentButton({ open, onOpenChange, slug, pageNumber, labels, senderName, getViewId }: Props) {
  const sender = senderName ?? labels.chatSenderFallback;

  // The panel is fixed to the screen: a landscape slide on a phone is too short to hold it
  return open ? (
    <VoicePanel
      slug={slug}
      pageNumber={pageNumber}
      labels={labels}
      sender={sender}
      getViewId={getViewId}
      onClose={() => onOpenChange(false)}
    />
  ) : (
    <Button
      size="sm"
      variant="outline"
      className="absolute right-3 bottom-3 z-10 rounded-full shadow-md"
      onClick={() => onOpenChange(true)}
    >
      <Mic /> {labels.voiceButton}
    </Button>
  );
}

function VoicePanel({
  slug,
  pageNumber,
  labels,
  sender,
  getViewId,
  onClose,
}: Omit<Props, "senderName" | "open" | "onOpenChange"> & { sender: string; onClose: () => void }) {
  const recorder = useMediaRecorder("AUDIO", VOICE_COMMENT_MAX_MS);
  const [state, setState] = useState<SendState>("idle");
  const remainingS = Math.ceil((VOICE_COMMENT_MAX_MS - recorder.elapsedMs) / 1000);
  const title = fillLabel(labels.voiceTitle, { page: pageNumber });
  const withSender = (text: string) => fillLabel(text, { sender });

  async function send() {
    const recording = recorder.recording;
    if (!recording) return;
    setState("sending");
    const contentType = baseMime(recording.mimeType);
    const body = new FormData();
    body.set("audio", new File([recording.blob], "voice", { type: contentType }));
    body.set("pageNumber", String(pageNumber));
    body.set("durationMs", String(recording.durationMs));
    const viewId = getViewId();
    if (viewId) body.set("viewId", viewId);
    try {
      const response = await fetch(`/api/v/${slug}/voice`, { method: "POST", body });
      setState(response.ok ? "sent" : response.status === 429 ? "limit" : "error");
    } catch {
      setState("error");
    }
  }

  const close = () => {
    recorder.reset();
    onClose();
  };

  const retry = () => {
    setState("idle");
    recorder.reset();
  };

  return (
    <section
      role="dialog"
      aria-label={title}
      onKeyDown={(event) => event.key === "Escape" && close()}
      className="fixed inset-x-0 bottom-0 z-50 animate-rise space-y-3 rounded-t-2xl bg-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))] text-sm shadow-xl ring-1 ring-border sm:inset-x-auto sm:right-4 sm:bottom-4 sm:w-80 sm:rounded-2xl"
    >
      <header className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{title}</p>
          <p className="text-small text-muted-foreground">{withSender(labels.voiceHint)}</p>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={close} aria-label={labels.chatClose}>
          <X />
        </Button>
      </header>

      {state === "sent" ? (
        <p role="status" className="flex items-center gap-2 text-success">
          <Check className="size-4" /> {withSender(labels.voiceSent)}
        </p>
      ) : (
        <>
          {recorder.recording && <audio src={recorder.recording.url} controls className="h-9 w-full" />}
          {recorder.status === "recording" && (
            <p className="flex items-center gap-2 tabular-nums" aria-live="polite">
              <span className="size-2 rounded-full bg-destructive motion-safe:animate-pulse" /> {remainingS} s
            </p>
          )}
          {recorder.error && (
            <p className="text-destructive">
              {recorder.error === "denied" ? labels.voiceMicDenied : recorder.error === "unsupported" ? labels.voiceUnsupported : labels.voiceError}
            </p>
          )}
          {state === "error" && <p className="text-destructive">{labels.voiceError}</p>}
          {state === "limit" && <p className="text-muted-foreground">{withSender(labels.voiceLimit)}</p>}

          <div className={cn("flex gap-2", recorder.status === "recorded" && "justify-between")}>
            {recorder.status === "recording" ? (
              <Button size="sm" variant="destructive" onClick={recorder.stop}>
                <Square /> {labels.voiceStop}
              </Button>
            ) : recorder.status === "recorded" ? (
              <>
                <Button size="sm" variant="ghost" disabled={state === "sending"} onClick={retry}>
                  <RotateCcw /> {labels.voiceRetry}
                </Button>
                <Button size="sm" disabled={state === "sending" || state === "limit"} onClick={send}>
                  {state === "sending" ? labels.voiceSending : labels.voiceSend}
                </Button>
              </>
            ) : (
              <Button size="sm" autoFocus disabled={recorder.status === "requesting"} onClick={recorder.start}>
                <Mic /> {labels.voiceStart}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
