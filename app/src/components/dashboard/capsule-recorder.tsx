"use client";

import { upload } from "@vercel/blob/client";
import { Mic, RotateCcw, Square, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { saveCapsule } from "@/app/(dashboard)/documents/capsule-actions";
import { useMediaRecorder, type RecorderError } from "@/components/media/use-media-recorder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CapsuleKind } from "@/generated/prisma/enums";
import { WELCOME_PAGE } from "@/lib/closing/capsules/resolve";
import { CAPSULE_HOOK_MAX, CAPSULE_MAX_MS, CAPSULE_POSTER_TYPE } from "@/lib/closing/media/limits";
import { baseMime, extensionFor } from "@/lib/closing/media/mime";
import { cn } from "@/lib/utils";

/** Where a capsule goes: the document (WELCOME_PAGE) or one of its pages, for every link (linkId null) or one. */
export type CapsuleTarget = {
  documentId: string;
  linkId: string | null;
  pageNumber: number;
  /** capsuleUploadPrefix of the workspace, checked again by the upload route. */
  uploadPrefix: string;
};

const RECORDER_ERRORS: Record<RecorderError, string> = {
  denied: "Accès à la caméra ou au micro refusé. Autorisez-le dans la barre d'adresse puis réessayez.",
  missing: "Aucune caméra ou aucun micro trouvé.",
  unsupported: "Ce navigateur ne sait pas enregistrer. Essayez Chrome, Edge, Firefox ou Safari récent.",
  failed: "L'enregistrement n'a pas marché, réessayez.",
};

export function CapsuleRecorderDialog({
  open,
  onOpenChange,
  target,
  initialHook,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: CapsuleTarget;
  initialHook: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {target.pageNumber === WELCOME_PAGE ? (
            <>
              <DialogTitle>{target.linkId ? "Mot d'accueil pour ce prospect" : "Mot d'accueil"}</DialogTitle>
              <DialogDescription>
                Jusqu&apos;à {CAPSULE_MAX_MS / 1000} secondes pour présenter le document de vive voix. Le prospect voit
                votre bulle dès l&apos;ouverture, sur toutes les pages.
              </DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>Capsule de la page {target.pageNumber}</DialogTitle>
              <DialogDescription>
                {CAPSULE_MAX_MS / 1000} secondes pour expliquer cette page de vive voix. Le prospect la voit apparaître
                dans une bulle quand il arrive ici.
              </DialogDescription>
            </>
          )}
        </DialogHeader>
        {/* Mounted only while open: closing the dialog frees the camera */}
        {open && (
          <Recorder target={target} initialHook={initialHook} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function Recorder({ target, initialHook, onDone }: { target: CapsuleTarget; initialHook: string; onDone: () => void }) {
  const { documentId, linkId, pageNumber, uploadPrefix } = target;
  const [kind, setKind] = useState<CapsuleKind>("VIDEO");
  const [hook, setHook] = useState(initialHook);
  const [progress, setProgress] = useState<number | null>(null);
  const recorder = useMediaRecorder(kind, CAPSULE_MAX_MS);
  const router = useRouter();
  const liveRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (liveRef.current) liveRef.current.srcObject = recorder.stream;
  }, [recorder.stream]);

  const busy = recorder.status === "requesting" || recorder.status === "recording" || progress !== null;
  const remainingS = Math.ceil((CAPSULE_MAX_MS - recorder.elapsedMs) / 1000);

  async function save() {
    const recording = recorder.recording;
    if (!recording) return;
    setProgress(0);
    try {
      const contentType = baseMime(recording.mimeType);
      const base = `${uploadPrefix}${documentId}-${pageNumber === WELCOME_PAGE ? "welcome" : `p${pageNumber}`}`;
      const [blob, poster] = await Promise.all([
        upload(`${base}.${extensionFor(contentType)}`, recording.blob, {
          access: "private",
          handleUploadUrl: "/api/upload",
          contentType,
          onUploadProgress: ({ percentage }) => setProgress(percentage),
        }),
        kind === "VIDEO" ? uploadPoster(recording.url, `${base}-poster.jpg`) : null,
      ]);
      const result = await saveCapsule({
        documentId,
        linkId,
        pageNumber,
        kind,
        pathname: blob.pathname,
        posterPathname: poster,
        durationMs: recording.durationMs,
        hookText: hook,
      });
      if ("error" in result) {
        toast.error(result.error);
        setProgress(null);
        return;
      }
      toast.success(pageNumber === WELCOME_PAGE ? "Mot d'accueil enregistré" : "Capsule enregistrée");
      router.refresh();
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'envoi a échoué.");
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="radiogroup" aria-label="Type de capsule">
        {(["VIDEO", "AUDIO"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            disabled={busy || recorder.status === "recorded"}
            onClick={() => setKind(option)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm transition-colors disabled:opacity-60",
              kind === option ? "bg-card shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option === "VIDEO" ? <Video className="size-4" /> : <Mic className="size-4" />}
            {option === "VIDEO" ? "Vidéo" : "Audio seul"}
          </button>
        ))}
      </div>

      <div className="relative mx-auto flex size-48 items-center justify-center overflow-hidden rounded-full bg-muted">
        {recorder.recording ? (
          kind === "VIDEO" ? (
            <video src={recorder.recording.url} controls playsInline className="size-full object-cover" />
          ) : (
            <audio src={recorder.recording.url} controls className="w-44" />
          )
        ) : kind === "VIDEO" && recorder.stream ? (
          <video ref={liveRef} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" />
        ) : (
          <Mic className={cn("size-10 text-muted-foreground", recorder.status === "recording" && "animate-pulse text-destructive")} />
        )}
        {recorder.status === "recording" && (
          <span className="absolute top-3 rounded-full bg-destructive px-2 py-0.5 text-xs font-medium text-white tabular-nums">
            ● {remainingS} s
          </span>
        )}
      </div>

      {recorder.error && <p className="text-sm text-destructive">{RECORDER_ERRORS[recorder.error]}</p>}

      <label className="block space-y-1.5">
        <span className="text-sm font-medium">Phrase d&apos;accroche (facultatif)</span>
        <Input
          value={hook}
          maxLength={CAPSULE_HOOK_MAX}
          onChange={(event) => setHook(event.target.value)}
          placeholder={
            pageNumber === WELCOME_PAGE
              ? "En 1 minute, je vous présente cette proposition"
              : "Sur cette partie, laisse-moi t'expliquer pourquoi…"
          }
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
              {progress === null ? "Enregistrer" : `Envoi… ${Math.round(progress)} %`}
            </Button>
          </>
        ) : (
          <Button disabled={recorder.status === "requesting"} onClick={recorder.start}>
            {kind === "VIDEO" ? <Video /> : <Mic />} {recorder.status === "requesting" ? "Autorisation…" : "Démarrer"}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}

/** Uploads a still of the recording for the prospect's bubble; null when the browser can't grab one. */
async function uploadPoster(url: string, pathname: string) {
  try {
    const frame = await captureFrame(url);
    if (!frame) return null;
    const blob = await upload(pathname, frame, { access: "private", handleUploadUrl: "/api/upload", contentType: CAPSULE_POSTER_TYPE });
    return blob.pathname;
  } catch {
    return null;
  }
}

/** A square JPEG of the clip half a second in (the first frames are often black while the camera wakes up). */
function captureFrame(url: string, size = 320): Promise<Blob | null> {
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
      const side = Math.min(video.videoWidth, video.videoHeight);
      if (!side) return done(null);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) return done(null);
      context.drawImage(video, (video.videoWidth - side) / 2, (video.videoHeight - side) / 2, side, side, 0, 0, size, size);
      canvas.toBlob(done, CAPSULE_POSTER_TYPE, 0.8);
    };
    video.src = url;
  });
}
