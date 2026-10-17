"use client";

import { upload } from "@vercel/blob/client";
import { Mic, RotateCcw, Square, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { saveCapsule } from "@/app/(dashboard)/documents/capsule-actions";
import { uploadPoster } from "@/components/media/capture-frame";
import { useMediaRecorder, type RecorderError } from "@/components/media/use-media-recorder";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CapsuleKind } from "@/generated/prisma/enums";
import { WELCOME_PAGE } from "@/lib/closing/capsules/resolve";
import { CAPSULE_HOOK_MAX, CAPSULE_MAX_MS } from "@/lib/closing/media/limits";
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
  const t = useTranslations("documents.capsule");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          {target.pageNumber === WELCOME_PAGE ? (
            <>
              <DialogTitle>{target.linkId ? t("welcomeTitleProspect") : t("welcomeTitle")}</DialogTitle>
              <DialogDescription>{t("welcomeDescription", { seconds: CAPSULE_MAX_MS / 1000 })}</DialogDescription>
            </>
          ) : (
            <>
              <DialogTitle>{t("pageTitle", { page: target.pageNumber })}</DialogTitle>
              <DialogDescription>{t("pageDescription", { seconds: CAPSULE_MAX_MS / 1000 })}</DialogDescription>
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
  const t = useTranslations("documents.capsule");
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
      toast.success(pageNumber === WELCOME_PAGE ? t("savedWelcome") : t("savedCapsule"));
      router.refresh();
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("sendFailed"));
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-px border border-border bg-border" role="radiogroup" aria-label={t("kindAria")}>
        {(["VIDEO", "AUDIO"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={kind === option}
            disabled={busy || recorder.status === "recorded"}
            onClick={() => setKind(option)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1.5 bg-card py-1.5 text-small transition-colors disabled:opacity-60",
              kind === option
                ? "font-semibold text-foreground shadow-[inset_0_-2px_0_var(--foreground)]"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option === "VIDEO" ? <Video className="size-4" /> : <Mic className="size-4" />}
            {option === "VIDEO" ? t("video") : t("audioOnly")}
          </button>
        ))}
      </div>

      <div className="relative mx-auto flex aspect-[4/3] w-full max-w-64 items-center justify-center overflow-hidden bg-muted">
        {/* Keys: a fresh element for the take, or it keeps the stopped camera as srcObject and plays black */}
        {recorder.recording ? (
          kind === "VIDEO" ? (
            <video key="take" src={recorder.recording.url} controls playsInline className="size-full object-cover" />
          ) : (
            <audio src={recorder.recording.url} controls className="w-44" />
          )
        ) : kind === "VIDEO" && recorder.stream ? (
          <video key="live" ref={liveRef} autoPlay muted playsInline className="size-full -scale-x-100 object-cover" />
        ) : (
          <Mic className={cn("size-10 text-muted-foreground", recorder.status === "recording" && "animate-pulse text-destructive")} />
        )}
        {recorder.status === "recording" && (
          <span className="absolute top-3 flex items-center gap-1.5 rounded-sm bg-destructive px-2 py-0.5 font-mono text-micro font-medium text-white">
            <span aria-hidden className="size-1.5 animate-pulse rounded-full bg-white motion-reduce:animate-none" />
            {t("secondsLeft", { seconds: remainingS })}
          </span>
        )}
      </div>

      {recorder.error && <p className="text-small text-destructive">{t(`errors.${recorder.error satisfies RecorderError}`)}</p>}

      <label className="block space-y-1.5">
        <span className="text-small font-medium">{t("hookLabel")}</span>
        <Input
          value={hook}
          maxLength={CAPSULE_HOOK_MAX}
          onChange={(event) => setHook(event.target.value)}
          placeholder={
            pageNumber === WELCOME_PAGE
              ? t("hookPlaceholderWelcome")
              : t("hookPlaceholderPage")
          }
        />
      </label>

      <DialogFooter>
        {recorder.status === "recording" ? (
          <Button variant="destructive" onClick={recorder.stop}>
            <Square /> {t("stop")}
          </Button>
        ) : recorder.status === "recorded" ? (
          <>
            <Button variant="outline" disabled={progress !== null} onClick={recorder.reset}>
              <RotateCcw /> {t("restart")}
            </Button>
            <Button disabled={progress !== null} onClick={save}>
              {progress === null ? t("save") : t("sending", { percent: Math.round(progress) })}
            </Button>
          </>
        ) : (
          <Button disabled={recorder.status === "requesting"} onClick={recorder.start}>
            {kind === "VIDEO" ? <Video /> : <Mic />} {recorder.status === "requesting" ? t("requesting") : t("start")}
          </Button>
        )}
      </DialogFooter>
    </div>
  );
}
