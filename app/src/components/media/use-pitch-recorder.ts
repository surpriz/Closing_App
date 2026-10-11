"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  PITCH_AUDIO_IN_VIDEO_BPS,
  PITCH_CAMERA_VIDEO_BPS,
  PITCH_MAX_MS,
  PITCH_SCREEN_VIDEO_BPS,
  PITCH_TRANSCRIPT_AUDIO_BPS,
} from "@/lib/closing/media/limits";
import { pickMimeType } from "@/lib/closing/media/mime";

import { recorderErrorOf, type RecorderError, type RecorderStatus } from "./use-media-recorder";

/** camera: the seller facing the webcam; screen: a shared screen with the webcam in a round bubble. */
export type PitchSource = "camera" | "screen";

export type PitchRecording = {
  video: Blob;
  videoType: string;
  /** The mic alone, what gets transcribed. Null when the browser could not record it. */
  audio: Blob | null;
  audioType: string | null;
  url: string;
  durationMs: number;
};

const FRAME_RATE = 30;

/** Screen sharing: desktop browsers only, and a canvas that can be recorded. */
export function canShareScreen() {
  if (typeof navigator === "undefined" || typeof HTMLCanvasElement === "undefined") return false;
  if (/Android|iPhone|iPad|iPod|Mobi/i.test(navigator.userAgent)) return false;
  return !!navigator.mediaDevices && "getDisplayMedia" in navigator.mediaDevices && "captureStream" in HTMLCanvasElement.prototype;
}

/**
 * Records a video pitch up to maxMs, then stops by itself. Next to the video,
 * a second recorder keeps the mic alone: a small file the server transcribes
 * (a 3 minute screen recording is far above what speech to text accepts).
 * Releases every device when done, reset or unmounted.
 */
export function usePitchRecorder(maxMs = PITCH_MAX_MS) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<RecorderError | null>(null);
  const [preview, setPreview] = useState<MediaStream | null>(null);
  const [recording, setRecording] = useState<PitchRecording | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recordersRef = useRef<MediaRecorder[]>([]);
  // Everything to stop or close when the recording ends: tracks, the compositor, the audio mix
  const cleanupsRef = useRef<(() => void)[]>([]);
  const urlRef = useRef<string | null>(null);
  const timerRef = useRef<number | null>(null);
  // Bumped by reset: a start() still waiting for a permission prompt knows it was cancelled
  const generationRef = useRef(0);

  const releaseDevices = useCallback(() => {
    if (timerRef.current !== null) window.clearInterval(timerRef.current);
    timerRef.current = null;
    cleanupsRef.current.forEach((cleanup) => cleanup());
    cleanupsRef.current = [];
    setPreview(null);
  }, []);

  const stop = useCallback(() => {
    recordersRef.current.forEach((recorder) => {
      if (recorder.state === "recording") recorder.stop();
    });
  }, []);

  const reset = useCallback(() => {
    generationRef.current += 1;
    recordersRef.current.forEach((recorder) => {
      recorder.onstop = null;
      if (recorder.state === "recording") recorder.stop();
    });
    recordersRef.current = [];
    releaseDevices();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setRecording(null);
    setElapsedMs(0);
    setError(null);
    setStatus("idle");
  }, [releaseDevices]);

  const fail = useCallback(
    (reason: RecorderError) => {
      releaseDevices();
      setError(reason);
      setStatus("error");
    },
    [releaseDevices],
  );

  const start = useCallback(
    async (source: PitchSource) => {
      reset();
      const generation = generationRef.current;
      const devices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
      if (typeof MediaRecorder === "undefined" || !devices?.getUserMedia || (source === "screen" && !canShareScreen())) {
        setError("unsupported");
        setStatus("error");
        return;
      }
      setStatus("requesting");
      const cleanups = cleanupsRef.current;
      const keep = (stream: MediaStream) => {
        cleanups.push(() => stream.getTracks().forEach((track) => track.stop()));
        return stream;
      };

      let display: MediaStream | null = null;
      let camera: MediaStream;
      try {
        // The screen first, while the click still counts as the seller's gesture
        if (source === "screen") {
          display = keep(
            await devices.getDisplayMedia({
              video: { frameRate: FRAME_RATE, width: { max: 1920 }, height: { max: 1080 } },
              audio: true,
            }),
          );
        }
        camera = keep(
          await devices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
            video:
              source === "camera"
                ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" }
                : { width: { ideal: 480 }, height: { ideal: 480 }, facingMode: "user" },
          }),
        );
      } catch (cause) {
        // Cancelled meanwhile: the screen granted before the camera prompt failed is ours to stop
        if (generation !== generationRef.current) {
          cleanups.forEach((cleanup) => cleanup());
          return;
        }
        fail(recorderErrorOf(cause));
        return;
      }
      // Closed or restarted while the browser was asking: let go of the devices at once
      if (generation !== generationRef.current) {
        cleanups.forEach((cleanup) => cleanup());
        return;
      }

      const mic = camera.getAudioTracks()[0];
      let recorded = camera;
      if (display) {
        const screenTrack = display.getVideoTracks()[0];
        const compositor = startCompositor(screenTrack, camera.getVideoTracks()[0]);
        cleanups.push(compositor.stop);
        const audio = mixAudio(mic, display.getAudioTracks()[0], cleanups);
        recorded = new MediaStream([compositor.track, ...(audio ? [audio] : [])]);
        // The browser's own "Stop sharing" button ends the take
        screenTrack.addEventListener("ended", () => stop());
        setPreview(new MediaStream([compositor.track]));
      } else {
        setPreview(camera);
      }

      const videoType = pickMimeType("VIDEO", (type) => MediaRecorder.isTypeSupported(type));
      const audioType = pickMimeType("AUDIO", (type) => MediaRecorder.isTypeSupported(type));
      let videoRecorder: MediaRecorder;
      try {
        videoRecorder = new MediaRecorder(recorded, {
          ...(videoType ? { mimeType: videoType } : {}),
          videoBitsPerSecond: display ? PITCH_SCREEN_VIDEO_BPS : PITCH_CAMERA_VIDEO_BPS,
          audioBitsPerSecond: PITCH_AUDIO_IN_VIDEO_BPS,
        });
      } catch {
        fail("unsupported");
        return;
      }
      let audioRecorder: MediaRecorder | null = null;
      if (mic) {
        try {
          audioRecorder = new MediaRecorder(new MediaStream([mic]), {
            ...(audioType ? { mimeType: audioType } : {}),
            audioBitsPerSecond: PITCH_TRANSCRIPT_AUDIO_BPS,
          });
        } catch {
          // No transcript then: the video still works
        }
      }

      const videoChunks: Blob[] = [];
      const audioChunks: Blob[] = [];
      videoRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) videoChunks.push(event.data);
      };
      if (audioRecorder) {
        audioRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) audioChunks.push(event.data);
        };
      }

      const recorders = audioRecorder ? [videoRecorder, audioRecorder] : [videoRecorder];
      const startedAt = performance.now();
      let running = recorders.length;
      const finish = () => {
        const durationMs = Math.min(Math.round(performance.now() - startedAt), maxMs);
        releaseDevices();
        recordersRef.current = [];
        const type = videoRecorder.mimeType || videoType || "video/webm";
        const video = new Blob(videoChunks, { type });
        if (!video.size) {
          setError("failed");
          setStatus("error");
          return;
        }
        const mime = audioRecorder ? audioRecorder.mimeType || audioType || "audio/webm" : null;
        const audio = mime && audioChunks.length ? new Blob(audioChunks, { type: mime }) : null;
        const url = URL.createObjectURL(video);
        urlRef.current = url;
        setRecording({ video, videoType: type, audio, audioType: audio ? mime : null, url, durationMs });
        setStatus("recorded");
      };
      // Both recorders hand over their last chunk before the take is ready
      recorders.forEach((recorder) => {
        recorder.onstop = () => {
          running -= 1;
          if (running === 0) finish();
        };
      });

      recordersRef.current = recorders;
      recorders.forEach((recorder) => recorder.start(1000));
      setStatus("recording");
      timerRef.current = window.setInterval(() => {
        const elapsed = performance.now() - startedAt;
        setElapsedMs(Math.min(elapsed, maxMs));
        if (elapsed >= maxMs) stop();
      }, 200);
    },
    [fail, maxMs, releaseDevices, reset, stop],
  );

  // Free the camera, the mic and the screen when the component goes away
  useEffect(() => reset, [reset]);

  return { status, error, preview, recording, elapsedMs, start, stop, reset };
}

/** A muted, playing <video> of one track, to draw it on a canvas. */
function playTrack(track: MediaStreamTrack) {
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.srcObject = new MediaStream([track]);
  void video.play().catch(() => {});
  return video;
}

/**
 * Draws the shared screen with the webcam in a round bubble, bottom left, on a
 * canvas that gets recorded. Frames are paced by a worker timer: the seller
 * goes to the window they share, this tab is hidden, and its own timers and
 * animation frames slow down or stop.
 */
function startCompositor(screen: MediaStreamTrack, camera: MediaStreamTrack | undefined) {
  const settings = screen.getSettings();
  const sourceWidth = settings.width || 1280;
  const sourceHeight = settings.height || 720;
  const scale = Math.min(1, 1920 / sourceWidth, 1080 / sourceHeight);
  const canvas = document.createElement("canvas");
  // Encoders want even sizes
  canvas.width = Math.round((sourceWidth * scale) / 2) * 2;
  canvas.height = Math.round((sourceHeight * scale) / 2) * 2;
  const context = canvas.getContext("2d")!;
  const screenVideo = playTrack(screen);
  const cameraVideo = camera ? playTrack(camera) : null;

  const draw = () => {
    const { width, height } = canvas;
    if (screenVideo.readyState >= 2) context.drawImage(screenVideo, 0, 0, width, height);
    if (!cameraVideo || cameraVideo.readyState < 2 || !cameraVideo.videoWidth) return;
    const diameter = Math.round(Math.min(width, height) * 0.24);
    const margin = Math.round(Math.min(width, height) * 0.03);
    const x = margin;
    const y = height - diameter - margin;
    const side = Math.min(cameraVideo.videoWidth, cameraVideo.videoHeight);
    context.save();
    context.beginPath();
    context.arc(x + diameter / 2, y + diameter / 2, diameter / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(
      cameraVideo,
      (cameraVideo.videoWidth - side) / 2,
      (cameraVideo.videoHeight - side) / 2,
      side,
      side,
      x,
      y,
      diameter,
      diameter,
    );
    context.restore();
    context.lineWidth = Math.max(2, Math.round(diameter * 0.025));
    context.strokeStyle = "#fff";
    context.beginPath();
    context.arc(x + diameter / 2, y + diameter / 2, diameter / 2, 0, Math.PI * 2);
    context.stroke();
  };

  const workerUrl = URL.createObjectURL(
    new Blob([`setInterval(() => postMessage(0), ${Math.round(1000 / FRAME_RATE)});`], { type: "text/javascript" }),
  );
  const worker = new Worker(workerUrl);
  worker.onmessage = draw;
  const track = canvas.captureStream(FRAME_RATE).getVideoTracks()[0];

  return {
    track,
    stop: () => {
      worker.terminate();
      URL.revokeObjectURL(workerUrl);
      track.stop();
      screenVideo.srcObject = null;
      if (cameraVideo) cameraVideo.srcObject = null;
    },
  };
}

/** The mic, mixed with the sound of the shared tab or screen when the seller shared it. */
function mixAudio(mic: MediaStreamTrack | undefined, shared: MediaStreamTrack | undefined, cleanups: (() => void)[]) {
  if (!shared) return mic ?? null;
  if (!mic) return shared;
  const audio = new AudioContext();
  cleanups.push(() => void audio.close());
  const mix = audio.createMediaStreamDestination();
  audio.createMediaStreamSource(new MediaStream([mic])).connect(mix);
  audio.createMediaStreamSource(new MediaStream([shared])).connect(mix);
  return mix.stream.getAudioTracks()[0];
}
