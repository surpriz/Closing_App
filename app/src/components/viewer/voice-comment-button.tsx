"use client";

import { Check, Mic, RotateCcw, Square, X } from "lucide-react";
import { useState } from "react";

import { useMediaRecorder } from "@/components/media/use-media-recorder";
import { Button } from "@/components/ui/button";
import { fillLabel, type ViewerLabels } from "@/lib/closing/i18n/viewer";
import { VOICE_COMMENT_MAX_MS } from "@/lib/closing/media/limits";
import { baseMime } from "@/lib/closing/media/mime";
import { cn } from "@/lib/utils";

type TriggerProps = {
  labels: ViewerLabels;
  onClick: () => void;
  /**
   * "bar": one more button in the call-to-action bar, icon only until lg.
   * "corner": bottom right of the page when there is no bar; a round 44px
   * button on touch screens, a labelled pill that shows up under the mouse
   * on desktop (the page container carries `group/page`).
   */
  placement: "bar" | "corner";
};

/** A mic on the page on screen: the prospect records a question, the seller gets it with its transcript. */
export function VoiceCommentButton({ labels, onClick, placement }: TriggerProps) {
  return (
    <Button
      variant="outline"
      size="lg"
      aria-label={labels.voiceButton}
      onClick={onClick}
      className={cn(
        "h-11 w-11 px-0",
        placement === "bar"
          ? "lg:w-auto lg:px-4"
          : "absolute right-3 bottom-3 z-10 rounded-full opacity-0 shadow-md transition-opacity group-hover/page:opacity-100 focus-visible:opacity-100 sm:w-auto sm:px-4 [@media(hover:none)]:opacity-100",
      )}
    >
      <Mic />
      <span className={placement === "bar" ? "hidden lg:inline" : "hidden sm:inline"}>{labels.voiceButton}</span>
    </Button>
  );
}

type PanelProps = {
  slug: string;
  pageNumber: number;
  labels: ViewerLabels;
  senderName: string | null;
  getViewId: () => string | null;
  onClose: () => void;
};

type SendState = "idle" | "sending" | "sent" | "error" | "limit";

/** The recorder, fixed to the screen: a landscape slide on a phone is too short to hold it. */
export function VoiceCommentPanel({ slug, pageNumber, labels, senderName, getViewId, onClose }: PanelProps) {
  const sender = senderName ?? labels.chatSenderFallback;
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
        <Button variant="ghost" size="icon" className="-mt-1 size-11 sm:size-9" onClick={close} aria-label={labels.chatClose}>
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
              <Button size="sm" variant="destructive" className="h-11 sm:h-9" onClick={recorder.stop}>
                <Square /> {labels.voiceStop}
              </Button>
            ) : recorder.status === "recorded" ? (
              <>
                <Button size="sm" variant="ghost" className="h-11 sm:h-9" disabled={state === "sending"} onClick={retry}>
                  <RotateCcw /> {labels.voiceRetry}
                </Button>
                <Button size="sm" className="h-11 sm:h-9" disabled={state === "sending" || state === "limit"} onClick={send}>
                  {state === "sending" ? labels.voiceSending : labels.voiceSend}
                </Button>
              </>
            ) : (
              <Button size="sm" className="h-11 sm:h-9" autoFocus disabled={recorder.status === "requesting"} onClick={recorder.start}>
                <Mic /> {labels.voiceStart}
              </Button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
