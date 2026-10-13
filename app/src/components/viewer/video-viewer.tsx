"use client";

import { Play } from "lucide-react";
import { useRef, useState } from "react";

import type { DealStatus } from "@/generated/prisma/enums";
import type { BookingTarget } from "@/lib/closing/booking/url";
import type { SupportedLocale } from "@/lib/closing/constants";
import { segmentAt, VIDEO_SEGMENTS } from "@/lib/closing/documents/video-segments";
import type { ViewerLabels } from "@/lib/closing/i18n/viewer";

import { ChatWidget, type ChatWidgetData } from "./chat-widget";
import { CtaBar } from "./cta-bar";
import { ExpiryChip } from "./expiry-countdown";
import { PrivacyNotice } from "./privacy-notice";
import { usePageTracking } from "./use-page-tracking";
import { ViewerHeader } from "./viewer-header";

type Props = {
  slug: string;
  documentName: string;
  senderName: string | null;
  /** The video, served with byte ranges; `?poster` gives its still. */
  src: string;
  poster: string | null;
  /** Measured by the recorder: WebM files often don't say how long they are. */
  durationMs: number | null;
  labels: ViewerLabels;
  /** "Demander un devis" (Link.ctaEnabled). */
  quote: boolean;
  booking: BookingTarget | null;
  dealStatus: DealStatus;
  locale: SupportedLocale;
  /** Null when the assistant is off for this link or the transcript is not there yet. */
  chat: ChatWidgetData | null;
  countdown?: boolean;
};

/**
 * A video pitch: the video in the middle, the seller's buttons under it. Each
 * tenth of the video counts as a page, and time counts while it plays, so the
 * seller sees how far the prospect watched and what they replayed.
 */
export function VideoViewer({
  slug,
  documentName,
  senderName,
  src,
  poster,
  durationMs,
  labels,
  quote,
  booking,
  dealStatus,
  locale,
  chat,
  countdown,
}: Props) {
  const { getViewId, setPage, setActive } = usePageTracking(slug, VIDEO_SEGMENTS, { manual: true });
  const videoRef = useRef<HTMLVideoElement>(null);
  const [started, setStarted] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [failed, setFailed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const barVisible = quote || !!booking;

  function followPosition(video: HTMLVideoElement) {
    const length = Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : (durationMs ?? 0);
    setPage(segmentAt(video.currentTime * 1000, length));
  }

  return (
    <div className="flex h-dvh flex-col bg-background selection:bg-foreground/15 selection:text-foreground">
      <ViewerHeader
        className="shrink-0"
        kind="video"
        documentName={documentName}
        senderName={senderName}
        labels={labels}
        aside={countdown && <ExpiryChip labels={labels} />}
      />

      <main
        className={`flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-2 pt-3 sm:px-6 ${barVisible ? "pb-[calc(var(--decision-bar-h,4rem)+1rem)]" : chat ? "pb-20" : "pb-4"}`}
      >
        <div className="relative w-full max-w-5xl overflow-hidden bg-black ring-1 ring-border">
          {failed ? (
            <p role="alert" className="flex aspect-video items-center justify-center px-6 text-center text-body text-white/85">
              {labels.videoError}
            </p>
          ) : (
            <>
              <video
                ref={videoRef}
                src={src}
                poster={poster ?? undefined}
                controls={started}
                playsInline
                preload="metadata"
                controlsList="nodownload"
                className="block aspect-video max-h-[calc(100dvh-15rem)] w-full object-contain"
                onPlay={() => {
                  setStarted(true);
                  setActive(true);
                }}
                onPlaying={() => setActive(true)}
                onPause={() => setActive(false)}
                onWaiting={() => setActive(false)}
                onSeeking={() => setActive(false)}
                onSeeked={(event) => setActive(!event.currentTarget.paused)}
                onTimeUpdate={(event) => followPosition(event.currentTarget)}
                onEnded={() => {
                  setActive(false);
                  setAtEnd(true);
                }}
                onError={() => {
                  setActive(false);
                  setFailed(true);
                }}
              />
              {!started && (
                // Sound needs a tap anyway: one big button rather than an autoplay the browser would mute
                <button
                  type="button"
                  aria-label={labels.playVideo}
                  onClick={() => void videoRef.current?.play().catch(() => {})}
                  className="group absolute inset-0 flex items-center justify-center bg-black/15 outline-none transition-colors hover:bg-black/30 focus-visible:ring-3 focus-visible:ring-white/70 focus-visible:ring-inset"
                >
                  <span className="flex size-16 items-center justify-center rounded-md bg-white text-black transition-transform duration-150 ease-out-soft group-hover:scale-105 sm:size-20">
                    <Play className="ml-1 size-7 fill-current sm:size-8" aria-hidden />
                  </span>
                </button>
              )}
            </>
          )}
        </div>
        <PrivacyNotice labels={labels} video className="px-2 text-center" />
      </main>

      {barVisible && (
        <CtaBar
          slug={slug}
          labels={labels}
          initialStatus={dealStatus}
          getViewId={getViewId}
          documentName={documentName}
          atEnd={atEnd}
          signerName={null}
          answers={false}
          quote={quote}
          booking={booking}
          onAskQuestion={chat ? () => setChatOpen(true) : undefined}
        />
      )}

      {chat && (
        <ChatWidget
          {...chat}
          slug={slug}
          labels={labels}
          locale={locale}
          senderName={senderName}
          getViewId={getViewId}
          open={chatOpen}
          onOpenChange={setChatOpen}
          launcher={barVisible ? "docked" : "floating"}
        />
      )}
    </div>
  );
}
