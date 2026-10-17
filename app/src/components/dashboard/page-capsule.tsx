"use client";

import { Pencil, Play, Trash2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteCapsule } from "@/app/(dashboard)/documents/capsule-actions";
import { Button } from "@/components/ui/button";
import type { CapsuleKind } from "@/generated/prisma/enums";

import { CapsuleRecorderDialog, type CapsuleTarget } from "./capsule-recorder";

export type CapsuleSummary = {
  id: string;
  kind: CapsuleKind;
  hookText: string | null;
  durationMs: number;
  plays: number;
};

/**
 * The capsule of one page: a short clip the prospect sees in a bubble when
 * reaching the page. linkId null = the document's, shown on every link.
 */
export function PageCapsuleControl({
  target,
  capsule,
  inherited,
  addLabel,
  legacy,
}: {
  target: CapsuleTarget;
  capsule: CapsuleSummary | null;
  /** Link page: the document's capsule shows here until the seller records one for this link. */
  inherited?: boolean;
  /** Button when there is nothing to show yet, or a version for one link. */
  addLabel?: string;
  /** A page capsule from before the welcome message: it can go, not be re-recorded. */
  legacy?: boolean;
}) {
  const t = useTranslations("documents.pageCapsule");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const dialog = (
    <CapsuleRecorderDialog open={open} onOpenChange={setOpen} target={target} initialHook={capsule?.hookText ?? ""} />
  );

  if (!capsule || inherited) {
    return (
      <>
        <Button size="xs" variant="outline" onClick={() => setOpen(true)}>
          <Video /> {addLabel ?? (inherited ? t("forProspect") : t("add"))}
        </Button>
        {dialog}
      </>
    );
  }

  const remove = () =>
    startTransition(async () => {
      const result = await deleteCapsule(capsule.id);
      if ("error" in result) toast.error(result.error);
      else {
        toast.success(target.linkId ? t("removedPersonal") : t("removed"));
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-3 border border-border bg-card p-2">
      <CapsulePreview capsule={capsule} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-body">{capsule.hookText ?? <span className="text-muted-foreground">{t("noHook")}</span>}</p>
        <p className="text-small text-muted-foreground">
          {capsule.kind === "VIDEO" ? t("video") : t("audio")} ·{" "}
          {t("duration", { seconds: Math.round(capsule.durationMs / 1000) })} ·{" "}
          {capsule.plays === 0 ? t("notWatched") : t("watched", { count: capsule.plays })}
        </p>
      </div>
      <div className="flex gap-1">
        {!legacy && (
          <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
            <Pencil /> {t("replace")}
          </Button>
        )}
        <Button size="xs" variant="ghost" disabled={pending} onClick={remove} aria-label={t("deleteAria")}>
          <Trash2 />
        </Button>
      </div>
      {dialog}
    </div>
  );
}

function CapsulePreview({ capsule }: { capsule: CapsuleSummary }) {
  const src = `/api/capsules/${capsule.id}/media`;
  if (capsule.kind === "AUDIO") return <audio controls preload="none" src={src} className="h-8 w-56 max-w-full" />;
  return <VideoThumb src={src} />;
}

/**
 * Native controls do not fit in a small thumbnail, and Chrome recordings carry no
 * duration: show the first frame and play on click instead.
 */
function VideoThumb({ src }: { src: string }) {
  const t = useTranslations("documents.pageCapsule");
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const toggle = () => {
    const video = ref.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  };
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={playing ? t("pause") : t("play")}
      className="relative aspect-[4/3] w-24 shrink-0 overflow-hidden bg-black"
    >
      <video
        ref={ref}
        playsInline
        preload="metadata"
        src={`${src}#t=0.1`}
        // The still when there is one, else the browser shows the first frame
        poster={`${src}?poster`}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        className="size-full object-cover"
      />
      {!playing && (
        <span className="absolute inset-0 flex items-center justify-center bg-black/30 text-white">
          <Play className="size-6 fill-current" aria-hidden />
        </span>
      )}
    </button>
  );
}
