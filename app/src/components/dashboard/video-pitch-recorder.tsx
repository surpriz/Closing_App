"use client";

import { upload } from "@vercel/blob/client";
import { Monitor, RotateCcw, Square, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { checkPitchAllowance, createVideoDocument } from "@/app/(dashboard)/documents/actions";
import { isUpgradePrompt, openUpgrade } from "@/components/billing/upgrade-dialog";
import { uploadPoster } from "@/components/media/capture-frame";
import type { RecorderError } from "@/components/media/use-media-recorder";
import { canShareScreen, usePitchRecorder, type PitchSource } from "@/components/media/use-pitch-recorder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MULTIPART_THRESHOLD_BYTES, PITCH_MAX_MS } from "@/lib/closing/media/limits";
import { baseMime, extensionFor } from "@/lib/closing/media/mime";
import { isStaleDeployment } from "@/lib/stale-deployment";
import { cn } from "@/lib/utils";

const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** "Enregistrer un pitch vidéo": the video becomes the document, and a link ready to send. */
export function VideoPitchDialog({
  open,
  onOpenChange,
  uploadPrefix,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** pitchUploadPrefix of the workspace, checked again by the upload route. */
  uploadPrefix: string;
}) {
  const t = useTranslations("documents.pitch");

  // Over the plan: say so before the camera turns on, not after the take
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void checkPitchAllowance().then((refused) => {
      if (cancelled || !refused) return;
      onOpenChange(false);
      openUpgrade(refused);
    });
    return () => {
      cancelled = true;
    };
  }, [open, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-heading">{t("title")}</DialogTitle>
          <DialogDescription>{t("description", { minutes: PITCH_MAX_MS / 60_000 })}</DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: closing the dialog frees the camera and the screen */}
        {open && <PitchRecorder uploadPrefix={uploadPrefix} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PitchRecorder({ uploadPrefix, onDone }: { uploadPrefix: string; onDone: () => void }) {
  const t = useTranslations("documents.pitch");
  const [screenAllowed] = useState(canShareScreen);
  const [source, setSource] = useState<PitchSource>("camera");
  const [title, setTitle] = useState("");
  const [progress, setProgress] = useState<number | null>(null);
  const recorder = usePitchRecorder(PITCH_MAX_MS);
  const router = useRouter();
  const liveRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (liveRef.current) liveRef.current.srcObject = recorder.preview;
  }, [recorder.preview]);

  const busy = recorder.status === "requesting" || recorder.status === "recording" || progress !== null;

  // Leaving the page now would lose the take
  useEffect(() => {
    if (!busy && recorder.status !== "recorded") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, recorder.status]);

  async function save() {
    const take = recorder.recording;
    if (!take) return;
    setProgress(0);
    try {
      const base = `${uploadPrefix}pitch`;
      const contentType = baseMime(take.videoType);
      const [video, audioPathname, posterPathname] = await Promise.all([
        upload(`${base}.${extensionFor(contentType)}`, take.video, {
          access: "private",
          handleUploadUrl: "/api/upload",
          contentType,
          multipart: take.video.size > MULTIPART_THRESHOLD_BYTES,
          onUploadProgress: ({ percentage }) => setProgress(percentage),
        }),
        // Only for the transcript: the video goes without it
        take.audio && take.audioType
          ? upload(`${base}-voice.${extensionFor(take.audioType)}`, take.audio, {
              access: "private",
              handleUploadUrl: "/api/upload",
              contentType: baseMime(take.audioType),
            })
              .then((blob) => blob.pathname)
              .catch(() => null)
          : null,
        uploadPoster(take.url, `${base}-poster.jpg`, { square: false, width: 960 }),
      ]);
      const result = await createVideoDocument({
        videoPathname: video.pathname,
        audioPathname,
        posterPathname,
        durationMs: take.durationMs,
        name: title.trim() || undefined,
      });
      if (isUpgradePrompt(result)) {
        onDone();
        openUpgrade(result);
        return;
      }
      if ("error" in result) {
        toast.error(result.error);
        setProgress(null);
        return;
      }
      onDone();
      router.push(`/links/${result.linkId}?new=1`);
    } catch (error) {
      if (isStaleDeployment(error)) {
        // The take can't be saved from this tab any more: say why, and offer the reload
        toast.error(t("staleDeployment"), {
          duration: Infinity,
          action: { label: t("reload"), onClick: () => window.location.reload() },
        });
      } else {
        toast.error(error instanceof Error ? error.message : t("sendFailed"));
      }
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      {screenAllowed && (
        <div className="flex gap-px border border-foreground bg-foreground" role="radiogroup" aria-label={t("sourceAria")}>
          {(["camera", "screen"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={source === option}
              disabled={busy || recorder.status === "recorded"}
              onClick={() => setSource(option)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 py-1.5 text-small transition-colors duration-150 outline-none focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:ring-inset disabled:opacity-60",
                source === option
                  ? "bg-foreground font-medium text-background"
                  : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {option === "camera" ? <Video className="size-4" /> : <Monitor className="size-4" />}
              {option === "camera" ? t("camera") : t("screen")}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex aspect-video items-center justify-center overflow-hidden border border-foreground bg-muted">
        {/* Keys: a fresh element for the take, or it keeps the stopped camera as srcObject and plays black */}
        {recorder.recording ? (
          <video
            key="take"
            src={recorder.recording.url}
            controls
            playsInline
            className="size-full bg-black object-contain"
          />
        ) : recorder.preview ? (
          <video
            key="live"
            ref={liveRef}
            autoPlay
            muted
            playsInline
            className={cn("size-full object-contain", source === "camera" && "-scale-x-100")}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-6 text-center text-small text-muted-foreground">
            {source === "camera" ? <Video className="size-8" /> : <Monitor className="size-8" />}
            {source === "camera"
              ? t("cameraHint")
              : t("screenHint")}
          </div>
        )}
        {recorder.status === "recording" && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 bg-black/75 px-2 py-0.5 font-mono text-micro text-white">
            <span aria-hidden className="size-1.5 animate-pulse bg-destructive motion-reduce:animate-none" />
            <span className="sr-only">{t("remaining")}</span>
            {clock(PITCH_MAX_MS - recorder.elapsedMs)}
          </span>
        )}
      </div>

      {source === "screen" && recorder.status === "recording" && (
        <p className="text-small text-muted-foreground">{t("screenNote")}</p>
      )}
      {recorder.error && <p className="text-small text-destructive">{t(`errors.${recorder.error satisfies RecorderError}`)}</p>}

      <label className="block space-y-1.5">
        <span className="text-small font-medium">{t("titleLabel")}</span>
        <Input
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={t("titlePlaceholder")}
          disabled={progress !== null}
        />
      </label>

      <DialogFooter>
        {recorder.status === "recording" ? (
          <Button onClick={recorder.stop}>
            <Square /> {t("stop")}
          </Button>
        ) : recorder.status === "recorded" ? (
          <>
            <Button variant="outline" disabled={progress !== null} onClick={recorder.reset}>
              <RotateCcw /> {t("restart")}
            </Button>
            <Button disabled={progress !== null} onClick={save}>
              {progress === null ? t("createLink") : t("sending", { percent: Math.round(progress) })}
            </Button>
          </>
        ) : (
          <Button
            disabled={recorder.status === "requesting"}
            onClick={() => void recorder.start(source)}
          >
            {source === "camera" ? <Video /> : <Monitor />}
            {recorder.status === "requesting" ? t("requesting") : t("start")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
