"use client";

import { upload } from "@vercel/blob/client";

import { CAPSULE_POSTER_TYPE } from "@/lib/closing/media/limits";

type FrameShape = { square: true; size: number } | { square: false; width: number };

/**
 * A JPEG of the clip half a second in (the first frames are often black while
 * the camera wakes up): a centred square for the bubble, or the whole picture
 * for a video pitch. Null when the browser can't grab one.
 */
export function captureFrame(url: string, shape: FrameShape = { square: true, size: 320 }): Promise<Blob | null> {
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const timer = window.setTimeout(() => done(null), 4000);
    const done = (blob: Blob | null) => {
      window.clearTimeout(timer);
      video.removeAttribute("src");
      video.load();
      resolve(blob);
    };
    video.onerror = () => done(null);
    video.onloadeddata = () => {
      video.currentTime = 0.5;
    };
    video.onseeked = () => {
      const { videoWidth, videoHeight } = video;
      if (!videoWidth || !videoHeight) return done(null);
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) return done(null);
      if (shape.square) {
        const side = Math.min(videoWidth, videoHeight);
        canvas.width = canvas.height = shape.size;
        context.drawImage(video, (videoWidth - side) / 2, (videoHeight - side) / 2, side, side, 0, 0, shape.size, shape.size);
      } else {
        canvas.width = Math.min(shape.width, videoWidth);
        canvas.height = Math.round((canvas.width * videoHeight) / videoWidth);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
      }
      canvas.toBlob(done, CAPSULE_POSTER_TYPE, 0.8);
    };
    video.src = url;
  });
}

/** Uploads a still of the recording; null when there is none, the clip saves without it. */
export async function uploadPoster(url: string, pathname: string, shape?: FrameShape) {
  try {
    const frame = await captureFrame(url, shape);
    if (!frame) return null;
    const blob = await upload(pathname, frame, { access: "private", handleUploadUrl: "/api/upload", contentType: CAPSULE_POSTER_TYPE });
    return blob.pathname;
  } catch {
    return null;
  }
}
