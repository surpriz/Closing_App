"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AUDIO_BITS_PER_SECOND, VIDEO_BITS_PER_SECOND } from "@/lib/closing/media/limits";
import { pickMimeType, type MediaKind } from "@/lib/closing/media/mime";

export type RecorderStatus = "idle" | "requesting" | "recording" | "recorded" | "error";
/** denied: the browser or the user refused; missing: no camera or mic; unsupported: no MediaRecorder. */
export type RecorderError = "denied" | "missing" | "unsupported" | "failed";

export type Recording = { blob: Blob; url: string; mimeType: string; durationMs: number };

/**
 * Records the camera and mic (or the mic only) up to maxMs, then stops by
 * itself. Releases the devices and the preview URL when done or unmounted.
 */
export function useMediaRecorder(kind: MediaKind, maxMs: number) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const urlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  // Bumped by reset: a start() still waiting for the permission prompt knows it was cancelled
  const generationRef = useRef(0);

  const releaseDevices = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setStream(null);
  }, []);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    releaseDevices();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setRecording(null);
    setElapsedMs(0);
    setError(null);
    setStatus("idle");
  }, [releaseDevices]);

  const start = useCallback(async () => {
    reset();
    const generation = generationRef.current;
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("unsupported");
      setStatus("error");
      return;
    }
    setStatus("requesting");

    let media: MediaStream;
    try {
      media = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: kind === "VIDEO" ? { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: "user" } : false,
      });
    } catch (cause) {
      if (generation !== generationRef.current) return;
      const name = cause instanceof DOMException ? cause.name : "";
      setError(name === "NotAllowedError" || name === "SecurityError" ? "denied" : name === "NotFoundError" ? "missing" : "failed");
      setStatus("error");
      return;
    }
    // Closed or restarted while the browser was asking: let go of the devices at once
    if (generation !== generationRef.current) {
      media.getTracks().forEach((track) => track.stop());
      return;
    }
    streamRef.current = media;
    setStream(media);

    const mimeType = pickMimeType(kind, (type) => MediaRecorder.isTypeSupported(type));
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(media, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
        ...(kind === "VIDEO" ? { videoBitsPerSecond: VIDEO_BITS_PER_SECOND } : {}),
      });
    } catch {
      releaseDevices();
      setError("unsupported");
      setStatus("error");
      return;
    }

    const chunks: Blob[] = [];
    const startedAt = performance.now();
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const durationMs = Math.min(Math.round(performance.now() - startedAt), maxMs);
      releaseDevices();
      const type = recorder.mimeType || mimeType || (kind === "VIDEO" ? "video/webm" : "audio/webm");
      const blob = new Blob(chunks, { type });
      if (!blob.size) {
        setError("failed");
        setStatus("error");
        return;
      }
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      setRecording({ blob, url, mimeType: type, durationMs });
      setStatus("recorded");
    };

    recorderRef.current = recorder;
    recorder.start(1000);
    setStatus("recording");
    timerRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAt;
      setElapsedMs(Math.min(elapsed, maxMs));
      if (elapsed >= maxMs) stop();
    }, 200);
  }, [kind, maxMs, releaseDevices, reset, stop]);

  // Free the camera and mic when the component goes away
  useEffect(() => reset, [reset]);

  return { status, error, stream, recording, elapsedMs, start, stop, reset };
}
