"use client";

import { useEffect, type RefObject } from "react";

import type { VideoProvider } from "@/lib/closing/documents/web-link";
import { WatchedSeconds } from "@/lib/closing/tracking/watched";

const PLAYER_ORIGINS: Partial<Record<VideoProvider, string>> = {
  youtube: "https://www.youtube.com",
  vimeo: "https://player.vimeo.com",
};

function parse(data: unknown): Record<string, unknown> | null {
  if (typeof data === "object" && data !== null) return data as Record<string, unknown>;
  if (typeof data !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(data);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Follows playback of an embedded YouTube or Vimeo video through the
 * player's postMessage API and writes the share actually watched (0..1) into
 * `watchedRef`. Playing counts as activity, so a reader watching without
 * touching the mouse is not idle. Loom has no public player API: time only.
 */
export function useVideoProgress(
  iframeRef: RefObject<HTMLIFrameElement | null>,
  provider: VideoProvider | null,
  watchedRef: RefObject<number>,
  onPlaying: () => void,
) {
  useEffect(() => {
    const origin = provider && PLAYER_ORIGINS[provider];
    const iframe = iframeRef.current;
    if (!origin || !iframe) return;

    const watched = new WatchedSeconds();
    const post = (message: object) => iframe.contentWindow?.postMessage(JSON.stringify(message), origin);
    const subscribe = () => {
      if (provider === "youtube") post({ event: "listening", id: 1, channel: "widget" });
      else {
        post({ method: "addEventListener", value: "timeupdate" });
        post({ method: "addEventListener", value: "seeked" });
      }
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== origin || event.source !== iframe.contentWindow) return;
      const message = parse(event.data);
      if (!message) return;

      if (provider === "youtube") {
        const info = message.event === "infoDelivery" ? (message.info as Record<string, unknown> | undefined) : null;
        if (typeof info?.currentTime !== "number") return;
        const duration = typeof info.duration === "number" ? info.duration : 0;
        watched.update(info.currentTime, duration);
        // 1 = playing
        if (info.playerState === 1) onPlaying();
      } else {
        if (message.event === "ready") subscribe();
        if (message.event === "seeked") watched.reset();
        const data = message.data as Record<string, unknown> | undefined;
        if (message.event !== "timeupdate" || typeof data?.seconds !== "number") return;
        watched.update(data.seconds, typeof data.duration === "number" ? data.duration : 0);
        onPlaying();
      }
      watchedRef.current = Math.max(watchedRef.current, watched.ratio);
    };

    window.addEventListener("message", onMessage);
    // The player may be ready before us, or not yet: ask on load too
    iframe.addEventListener("load", subscribe);
    subscribe();
    return () => {
      window.removeEventListener("message", onMessage);
      iframe.removeEventListener("load", subscribe);
    };
  }, [iframeRef, provider, watchedRef, onPlaying]);
}
