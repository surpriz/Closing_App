"use client";

import { upload } from "@vercel/blob/client";
import { Monitor, RotateCcw, Square, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { createVideoDocument } from "@/app/(dashboard)/documents/actions";
import { uploadPoster } from "@/components/media/capture-frame";
import type { RecorderError } from "@/components/media/use-media-recorder";
import { canShareScreen, usePitchRecorder, type PitchSource } from "@/components/media/use-pitch-recorder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MULTIPART_THRESHOLD_BYTES, PITCH_MAX_MS } from "@/lib/closing/media/limits";
import { baseMime, extensionFor } from "@/lib/closing/media/mime";
import { cn } from "@/lib/utils";

const RECORDER_ERRORS: Record<RecorderError, string> = {
  denied: "Accès à la caméra, au micro ou à l'écran refusé. Autorisez-le dans la barre d'adresse puis réessayez.",
  missing: "Aucune caméra ou aucun micro trouvé.",
  unsupported: "Ce navigateur ne sait pas enregistrer. Essayez Chrome, Edge, Firefox ou Safari récent.",
  failed: "L'enregistrement n'a pas marché, réessayez.",
};

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
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Enregistrer un pitch vidéo</DialogTitle>
          <DialogDescription>
            Jusqu&apos;à {PITCH_MAX_MS / 60_000} minutes, face caméra ou en montrant votre écran. Le prospect voit la
            vidéo en grand, avec vos boutons rendez-vous et devis, et vous savez jusqu&apos;où il l&apos;a regardée.
          </DialogDescription>
        </DialogHeader>
        {/* Mounted only while open: closing the dialog frees the camera and the screen */}
        {open && <PitchRecorder uploadPrefix={uploadPrefix} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}

function PitchRecorder({ uploadPrefix, onDone }: { uploadPrefix: string; onDone: () => void }) {
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
      if ("error" in result) {
        toast.error(result.error);
        setProgress(null);
        return;
      }
      onDone();
      router.push(`/links/${result.linkId}?new=1`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'envoi a échoué.");
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      {screenAllowed && (
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Ce que vous enregistrez">
          {(["camera", "screen"] as const).map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={source === option}
              disabled={busy || recorder.status === "recorded"}
              onClick={() => setSource(option)}
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors disabled:opacity-60",
                source === option ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {option === "camera" ? <Video className="size-4" /> : <Monitor className="size-4" />}
              {option === "camera" ? "Caméra" : "Écran + caméra"}
            </button>
          ))}
        </div>
      )}

      <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-muted">
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
          <div className="flex flex-col items-center gap-2 px-6 text-center text-sm text-muted-foreground">
            {source === "camera" ? <Video className="size-8" /> : <Monitor className="size-8" />}
            {source === "camera"
              ? "Présentez-vous et dites au prospect ce que vous lui proposez."
              : "Choisissez l'écran, la fenêtre ou l'onglet à montrer. Votre caméra apparaît dans une bulle."}
          </div>
        )}
        {recorder.status === "recording" && (
          <span className="absolute top-3 left-3 rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-white tabular-nums">
            ● {clock(PITCH_MAX_MS - recorder.elapsedMs)}
          </span>
        )}
      </div>

      {source === "screen" && recorder.status === "recording" && (
        <p className="text-sm text-muted-foreground">
          Vous pouvez passer sur la fenêtre partagée : l&apos;enregistrement continue. Gardez seulement cet onglet ouvert.
        </p>
      )}
      {recorder.error && <p className="text-sm text-destructive">{RECORDER_ERRORS[recorder.error]}</p>}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Titre (facultatif)</span>
        <Input
          value={title}
          maxLength={200}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Proposition pour Acme"
          disabled={progress !== null}
        />
      </label>

      <DialogFooter>
        {recorder.status === "recording" ? (
          <Button variant="destructive" onClick={recorder.stop}>
            <Square /> Arrêter
          </Button>
        ) : recorder.status === "recorded" ? (
          <>
            <Button variant="outline" disabled={progress !== null} onClick={recorder.reset}>
              <RotateCcw /> Recommencer
            </Button>
            <Button disabled={progress !== null} onClick={save}>
              {progress === null ? "Créer le lien" : `Envoi… ${Math.round(progress)} %`}
            </Button>
          </>
        ) : (
          <Button
            variant="destructive"
            disabled={recorder.status === "requesting"}
            onClick={() => void recorder.start(source)}
          >
            {source === "camera" ? <Video /> : <Monitor />}
            {recorder.status === "requesting" ? "Autorisation…" : "Démarrer l'enregistrement"}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
