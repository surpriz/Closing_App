"use client";

import { upload } from "@vercel/blob/client";
import { FileUp, Link2, Plus, Video } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useEffectEvent, useRef, useState, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { checkLinkAllowance, createDocument, createWebDocument } from "@/app/(dashboard)/documents/actions";
import { isUpgradePrompt, openUpgrade } from "@/components/billing/upgrade-dialog";
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
export type AddedSource = {
  documentId: string;
  /** The link made on drop; null when the tour picks up a document added earlier. */
  linkId: string | null;
  /** The ready-made example, not one of the seller's own documents. */
  sample?: boolean;
};

function useAddSource(uploadPrefix: string, onDone?: () => void, onCreated?: (added: AddedSource) => void) {
  const t = useTranslations("documents.upload");
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);
  const [addingUrl, setAddingUrl] = useState(false);

  async function handleFile(file: File, { sample = false }: { sample?: boolean } = {}) {
    if (file.type !== "application/pdf") {
      toast.error(t("pdfOnly"));
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      toast.error(t("tooLarge"));
      return;
    }

    setProgress(0);
    try {
      const refused = await checkLinkAllowance();
      if (refused) {
        setProgress(null);
        onDone?.();
        openUpgrade(refused);
        return;
      }
      const blob = await upload(`${uploadPrefix}${safeFileName(file.name)}`, file, {
        access: "private",
        handleUploadUrl: "/api/upload",
        contentType: "application/pdf",
        multipart: file.size > 5 * 1024 * 1024,
        onUploadProgress: ({ percentage }) => setProgress(percentage),
      });

      const created = await createDocument({
        pathname: blob.pathname,
        name: file.name,
        sha256: await sha256Hex(file),
      });
      onDone?.();
      if ("upgrade" in created) {
        setProgress(null);
        openUpgrade(created);
        return;
      }
      const { id, linkId, reused, waiting } = created;
      if (onCreated) {
        setProgress(null);
        onCreated({ documentId: id, linkId, sample });
        return;
      }
      if (waiting) toast.success(t("alreadyWaiting"));
      else if (reused) toast.success(t("alreadyReused"));
      router.push(`/links/${linkId}?new=1`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("importFailed"));
      setProgress(null);
    }
  }

  // Returns false when the text is not a link, so the caller can explain
  async function handleUrl(text: string) {
    if (!parseWebUrl(text)) {
      toast.error(t("invalidUrl"));
      return false;
    }
    setAddingUrl(true);
    try {
      const result = await createWebDocument({ url: text });
      if (isUpgradePrompt(result)) {
        onDone?.();
        openUpgrade(result);
        return false;
      }
      if ("error" in result) {
        toast.error(result.error);
        return false;
      }
      onDone?.();
      if (onCreated) onCreated({ documentId: result.id, linkId: result.linkId });
      else router.push(`/links/${result.linkId}?new=1`);
      return true;
    } catch {
      toast.error(t("addLinkFailed"));
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
  const t = useTranslations("documents.upload");
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
          aria-label={t("urlAria")}
          placeholder={t("urlPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus={autoFocus}
          disabled={source.busy}
          className="h-9 pl-9"
        />
      </div>
      <Button type="submit" variant="outline" disabled={source.busy || !value.trim()}>
        {source.addingUrl ? t("adding") : t("add")}
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
  const t = useTranslations("documents.upload");
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
              {t.rich("importing", {
                percent: Math.round(progress ?? 0),
                mono: (chunks) => <span className="font-mono">{chunks}</span>,
              })}
            </p>
            <Progress value={progress ?? 0} />
          </>
        ) : (
          <div className="space-y-1">
            <p className="text-heading">{t("dropTitle")}</p>
            <p className="text-small text-muted-foreground">{t("dropHint")}</p>
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
            {t("recordPitch")}
          </Button>
          <span className="h-px flex-1 bg-border" />
        </div>
      )}
    </div>
  );
}

// While the big drop zone is on screen it owns drops and pastes: the header button stands back,
// so one file never gets imported twice
let mountedDropzones = 0;

export const OPEN_ADD_DOCUMENT_EVENT = "clozer:add-document";

/** Opens the header's "add a document" dialog from anywhere in the dashboard. */
export function openAddDocument() {
  window.dispatchEvent(new Event(OPEN_ADD_DOCUMENT_EVENT));
}

/**
 * Pasting a link or a file anywhere on the page adds it, unless the seller is
 * typing in a field.
 */
function usePasteToAdd(source: AddSource, enabled = true, yieldToDropzone = false) {
  const onPaste = useEffectEvent((event: ClipboardEvent) => {
    if (!enabled || source.busy || isTyping(event.target)) return;
    if (yieldToDropzone && mountedDropzones > 0) return;
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
  const t = useTranslations("documents.upload");
  const [loading, setLoading] = useState(false);

  async function loadSample() {
    setLoading(true);
    try {
      const response = await fetch(sample.url);
      if (!response.ok) throw new Error();
      const blob = await response.blob();
      await source.handleFile(new File([blob], sample.name, { type: "application/pdf" }), { sample: true });
    } catch {
      toast.error(t("sampleFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <p className="text-small text-muted-foreground">
      {t("noDocument")}{" "}
      <button
        type="button"
        disabled={source.busy || loading}
        onClick={() => void loadSample()}
        className="text-foreground underline underline-offset-4 disabled:opacity-50"
      >
        {loading ? t("loading") : t("trySample")}
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
  useEffect(() => {
    mountedDropzones += 1;
    return () => {
      mountedDropzones -= 1;
    };
  }, []);
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
 * The app header's "add a document" button, on every dashboard page. The whole window accepts a
 * dropped file or a pasted link, with a veil to show where it lands; page buttons open the same
 * dialog through openAddDocument().
 */
export function UploadButton({
  uploadPrefix,
  pitchUploadPrefix,
  trigger = true,
}: { uploadPrefix: string; /** false: another button opens the dialog through `openAddDocument()`. */ trigger?: boolean } & PitchProps) {
  const t = useTranslations("documents.upload");
  const [open, setOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [dragging, setDragging] = useState(false);
  const source = useAddSource(uploadPrefix, () => setOpen(false));
  const onDroppedFile = useEffectEvent((file: File) => void source.handleFile(file));
  const onDroppedUrl = useEffectEvent((url: string) => void source.handleUrl(url));
  // The dialog has its own drop zone and field
  usePasteToAdd(source, !open && !recording, true);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_ADD_DOCUMENT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_ADD_DOCUMENT_EVENT, onOpen);
  }, []);

  useEffect(() => {
    let depth = 0;
    const onEnter = (e: globalThis.DragEvent) => {
      if (!hasDroppable(e) || mountedDropzones > 0) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: globalThis.DragEvent) => {
      if (hasDroppable(e) && mountedDropzones === 0) e.preventDefault();
    };
    const onDrop = (e: globalThis.DragEvent) => {
      if (!hasDroppable(e) || mountedDropzones > 0) return;
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
      {/* Without its own button, the import still shows its progress where that button stood */}
      {!trigger && source.busy && (
        <Button disabled aria-live="polite" className="max-sm:size-9 max-sm:px-0">
          <Plus />
          <span className="max-sm:sr-only">
            {source.uploading
              ? t("importProgress", { percent: Math.round(source.progress ?? 0) })
              : t("addingLink")}
          </span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        {trigger && (
          <DialogTrigger
            render={<Button disabled={source.busy} aria-label={t("addDocument")} className="max-sm:size-9 max-sm:px-0" />}
          >
            <Plus />
            <span className="max-sm:sr-only">
              {source.uploading
                ? t("importProgress", { percent: Math.round(source.progress ?? 0) })
                : source.addingUrl
                  ? t("addingLink")
                  : t("addDocument")}
            </span>
          </DialogTrigger>
        )}
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-heading">{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
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
            {t("dropOverlay")}
          </p>
        </div>
      )}
    </>
  );
}
