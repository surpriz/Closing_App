"use client";

import { upload } from "@vercel/blob/client";
import { FileUp, Link2, Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { createDocument, createWebDocument } from "@/app/(dashboard)/documents/actions";
import { VideoPitchDialog } from "@/components/dashboard/video-pitch-recorder";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { MAX_UPLOAD_BYTES } from "@/lib/closing/constants";
import { parseWebUrl } from "@/lib/closing/documents/web-link";
import { cn } from "@/lib/utils";

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-120);
}

/** Lets the server spot a file it already has. Only a hint: it hashes the stored file again. */
async function sha256Hex(file: File) {
  try {
    const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  } catch {
    return undefined;
  }
}

// A dragged link comes as text/uri-list (from the address bar) or plain text
function droppedUrl(data: DataTransfer | null) {
  const text = data?.getData("text/uri-list") || data?.getData("text/plain") || "";
  const first = text.split(/\r?\n/).find((line) => line && !line.startsWith("#"));
  return first ?? "";
}

function hasDroppable(e: globalThis.DragEvent | DragEvent) {
  const types = e.dataTransfer?.types ?? [];
  return types.includes("Files") || types.includes("text/uri-list");
}

function isTyping(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

/** What was just added, for a caller that stays on the page instead of opening the share screen. */
export type AddedSource = { documentId: string; linkId: string };

function useAddSource(uploadPrefix: string, onDone?: () => void, onCreated?: (added: AddedSource) => void) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [addingUrl, setAddingUrl] = useState(false);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Pour l'instant, seuls les PDF sont acceptés. Exportez votre Word ou PowerPoint en PDF, ou collez un lien.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error("Fichier trop lourd (25 Mo maximum).");
      return;
    }

    setProgress(0);
    try {
      const blob = await upload(`${uploadPrefix}${safeFileName(file.name)}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
        contentType: "application/pdf",
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      const { id, linkId, reused } = await createDocument({
        pathname: blob.pathname,
        name: file.name,
        sha256: await sha256Hex(file),
      });
      onDone?.();
      if (onCreated) {
        setProgress(null);
        onCreated({ documentId: id, linkId });
        return;
      }
      if (reused) toast.success("Vous aviez déjà ce document : voici un nouveau lien.");
      router.push(`/links/${linkId}?new=1`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'import a échoué.");
      setProgress(null);
    }
  }

  // Returns false when the text is not a link, so the caller can explain
  async function handleUrl(text: string) {
    if (!parseWebUrl(text)) {
      toast.error("Ce lien n'est pas valide. Collez une adresse complète, par exemple https://notion.so/…");
      return false;
    }
    setAddingUrl(true);
    try {
      const result = await createWebDocument({ url: text });
      if ("error" in result) {
        toast.error(result.error);
        return false;
      }
      onDone?.();
      if (onCreated) onCreated({ documentId: result.id, linkId: result.linkId });
      else router.push(`/links/${result.linkId}?new=1`);
      return true;
    } catch {
      toast.error("L'ajout du lien a échoué.");
      return false;
    } finally {
      setAddingUrl(false);
    }
  }

  return {
    progress,
    uploading: progress !== null,
    addingUrl,
    busy: progress !== null || addingUrl,
    handleFile,
    handleUrl,
  };
}

type AddSource = ReturnType<typeof useAddSource>;

function FileInput({
  inputRef,
  onFile,
}: {
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
}) {
  return (
    <input
      ref={inputRef}
      type="file"
      accept="application/pdf"
      className="hidden"
      onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) onFile(file);
        e.target.value = "";
      }}
    />
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-1 w-48 overflow-hidden bg-foreground/10">
      <div className="h-full bg-foreground transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}

function UrlForm({ source, autoFocus }: { source: AddSource; autoFocus?: boolean }) {
  const [value, setValue] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await source.handleUrl(value)) setValue("");
  }

  return (
    <form onSubmit={onSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Link2 className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          inputMode="url"
          autoComplete="off"
          aria-label="Lien web"
          placeholder="Collez un lien Notion, Loom, Figma, Webflow…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          disabled={source.busy}
          className="h-9 pl-9"
        />
      </div>
      <Button type="submit" variant="outline" disabled={source.busy || !value.trim()}>
        {source.addingUrl ? "Ajout…" : "Ajouter"}
      </Button>
    </form>
  );
}

/** Drop area for a file (click or drop), a field for a web link, and a video pitch to record. */
function SourcePicker({
  source,
  autoFocusUrl,
  onRecordVideo,
}: {
  source: AddSource;
  autoFocusUrl?: boolean;
  onRecordVideo?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { progress, uploading, busy, handleFile, handleUrl } = source;

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
    else if (droppedUrl(event.dataTransfer)) void handleUrl(droppedUrl(event.dataTransfer));
  }

  return (
    <div className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => !busy && inputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click();
        }}
        onDragOver={(e) => {
          if (!hasDroppable(e)) return;
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 border border-dashed px-6 py-14 text-center transition-colors duration-150 outline-none focus-visible:border-foreground focus-visible:ring-3 focus-visible:ring-ring/30",
          dragging ? "border-solid border-foreground bg-card" : "border-foreground/40 hover:border-foreground hover:bg-card",
          busy && "cursor-progress",
        )}
      >
        <span className="flex size-11 items-center justify-center border border-foreground bg-card">
          <FileUp className="size-5" />
        </span>
        {uploading ? (
          <>
            <p className="font-medium">
              Import en cours, <span className="font-mono">{Math.round(progress ?? 0)} %</span>
            </p>
            <Progress value={progress ?? 0} />
          </>
        ) : (
          <div className="space-y-1">
            <p className="text-heading">Déposez un document ou un lien ici</p>
            <p className="text-small text-muted-foreground">
              Devis, présentation, proposition… en PDF, 25 Mo maximum
            </p>
          </div>
        )}
        <FileInput inputRef={inputRef} onFile={(file) => void handleFile(file)} />
      </div>
      <UrlForm source={source} autoFocus={autoFocusUrl} />
      {onRecordVideo && (
        <div className="flex items-center gap-3 pt-1">
          <span className="h-px flex-1 bg-border" />
          <Button variant="outline" size="lg" disabled={busy} onClick={onRecordVideo}>
            <Video />
            Enregistrer un pitch vidéo
          </Button>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
    </div>
  );
}

/**
 * Pasting a link or a file anywhere on the page adds it, unless the seller is
 * typing in a field.
 */
function usePasteToAdd(source: AddSource, enabled = true) {
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    if (!enabled || source.busy || isTyping(event.target)) return;
    const file = event.clipboardData?.files[0];
    if (file) {
      event.preventDefault();
      void source.handleFile(file);
      return;
    }
    const text = event.clipboardData?.getData("text/plain").trim() ?? "";
    if (parseWebUrl(text)) {
      event.preventDefault();
      void source.handleUrl(text);
    }
  });

  useEffect(() => {
    const listener = (event: ClipboardEvent) => onPaste(event);
    window.addEventListener("paste", listener);
    return () => window.removeEventListener("paste", listener);
  }, []);
}

type PitchProps = {
  /** pitchUploadPrefix of the workspace; without it, no "Enregistrer un pitch vidéo". */
  pitchUploadPrefix?: string;
};

/** A ready-made PDF for a seller with no document at hand (welcome tour). */
function SampleButton({ source, sample }: { source: AddSource; sample: { url: string; name: string } }) {
  const [loading, setLoading] = useState(false);

  async function loadSample() {
    setLoading(true);
    try {
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      await source.handleFile(new File([blob], sample.name, { type: "application/pdf" }));
    } catch {
      toast.error("Impossible de charger l'exemple. Déposez plutôt un de vos documents.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <p className="text-small text-muted-foreground">
      Pas de document sous la main ?{" "}
      <button
        type="button"
        disabled={source.busy || loading}
        onClick={() => void loadSample()}
        className="text-foreground underline underline-offset-4 disabled:opacity-50"
      >
        {loading ? "Chargement…" : "Essayer avec un devis exemple"}
      </button>
    </p>
  );
}

/** Large drop zone, used when there is no document yet. */
export function UploadDropzone({
  uploadPrefix,
  pitchUploadPrefix,
  onCreated,
  sample,
}: {
  uploadPrefix: string;
  /** Stay on the page once the document and its link exist, instead of opening the share screen. */
  onCreated?: (added: AddedSource) => void;
  sample?: { url: string; name: string };
} & PitchProps) {
  const source = useAddSource(uploadPrefix, undefined, onCreated);
  const [recording, setRecording] = useState(false);
  usePasteToAdd(source, !recording);
  return (
    <>
      <SourcePicker source={source} onRecordVideo={pitchUploadPrefix ? () => setRecording(true) : undefined} />
      {sample && <SampleButton source={source} sample={sample} />}
      {pitchUploadPrefix && (
        <VideoPitchDialog open={recording} onOpenChange={setRecording} uploadPrefix={pitchUploadPrefix} />
      )}
    </>
  );
}

/**
 * Header button once documents exist. The whole window still accepts a
 * dropped file or link, with a veil to show where it lands.
 */
export function UploadButton({ uploadPrefix, pitchUploadPrefix }: { uploadPrefix: string } & PitchProps) {
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dragging, setDragging] = useState(false);
  const source = useAddSource(uploadPrefix, () => setOpen(false));
  const onDroppedFile = useEffectEvent((file: File) => void source.handleFile(file));
  const onDroppedUrl = useEffectEvent((url: string) => void source.handleUrl(url));
  // The dialog has its own drop zone and field
  usePasteToAdd(source, !open && !recording);

  useEffect(() => {
    let depth = 0;
    const onEnter = (e: globalThis.DragEvent) => {
      if (!hasDroppable(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: globalThis.DragEvent) => {
      if (hasDroppable(e)) e.preventDefault();
    };
    const onDrop = (e: globalThis.DragEvent) => {
      if (!hasDroppable(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) onDroppedFile(file);
      else if (droppedUrl(e.dataTransfer)) onDroppedUrl(droppedUrl(e.dataTransfer));
    };
    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("dragover", onOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger render={<Button size="lg" disabled={source.busy} />}>
          <Plus />
          {source.uploading
            ? `Import, ${Math.round(source.progress ?? 0)} %`
            : source.addingUrl
              ? "Ajout du lien…"
              : "Ajouter un document / lien"}
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-heading">Ajouter un document ou un lien</DialogTitle>
            <DialogDescription>
              Un PDF (devis, présentation, proposition…), une page web (Notion, Loom, Figma, Webflow, Google
              Slides…), ou une vidéo que vous enregistrez ici.
            </DialogDescription>
          </DialogHeader>
          <SourcePicker
            source={source}
            autoFocusUrl
            onRecordVideo={
              pitchUploadPrefix
                ? () => {
                    setOpen(false);
                    setRecording(true);
                  }
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
      {pitchUploadPrefix && (
        <VideoPitchDialog open={recording} onOpenChange={setRecording} uploadPrefix={pitchUploadPrefix} />
      )}
      {dragging && !open && !recording && (
        <div className="pointer-events-none fixed inset-3 z-50 flex items-center justify-center border border-dashed border-foreground bg-background/85">
          <p className="border border-foreground bg-card px-5 py-2.5 text-body font-medium">
            Déposez le fichier ou le lien pour l&apos;ajouter
          </p>
        </div>
      )}
    </>
  );
}
