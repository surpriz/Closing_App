"use client";

import { Pencil, Trash2, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
}: {
  target: CapsuleTarget;
  capsule: CapsuleSummary | null;
  /** Link page: the document's capsule shows here until the seller records one for this link. */
  inherited?: boolean;
}) {
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
          <Video /> {inherited ? "Capsule pour ce prospect" : "Ajouter une capsule"}
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
        toast.success(target.linkId ? "Capsule retirée, celle du document reprend." : "Capsule supprimée");
        router.refresh();
      }
    });

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-muted/60 p-2">
      <CapsulePreview capsule={capsule} />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="truncate text-sm">{capsule.hookText ?? <span className="text-muted-foreground">Sans phrase d&apos;accroche</span>}</p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {capsule.kind === "VIDEO" ? "Vidéo" : "Audio"} · {Math.round(capsule.durationMs / 1000)} s ·{" "}
          {capsule.plays === 0 ? "pas encore regardée" : `regardée ${capsule.plays} fois`}
        </p>
      </div>
      <div className="flex gap-1">
        <Button size="xs" variant="ghost" onClick={() => setOpen(true)}>
          <Pencil /> Remplacer
        </Button>
        <Button size="xs" variant="ghost" disabled={pending} onClick={remove} aria-label="Supprimer la capsule">
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
  return (
    <video
      controls
      playsInline
      preload="metadata"
      src={src}
      className="size-20 shrink-0 rounded-full bg-black object-cover"
    />
  );
}

