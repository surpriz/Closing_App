"use client";

import { upload } from "@vercel/blob/client";
import { FileUp, Link2, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type DragEvent, type FormEvent } from "react";
import { toast } from "sonner";

import { createDocument, createWebDocument } from "@/app/(dashboard)/documents/actions";
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
import { cn } from "cn";

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-120);
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

function useAddSource(uploadPrefix: string, onDone?: () => void) {
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

      const { id } = await createDocument({ pathname: blob.pathname, name: file.name });
      toast.success("Document ajouté, analyse en cours.");
      onDone?.();
      router.push(`/documents/${id}`);
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
      toast.success("Lien ajouté.");
      onDone?.();
      router.push(`/documents/${result.id}`);
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
    <div className="h-1 w-48 overflow-hidden rounded-full bg-foreground/10">
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
      <Button type="submit" size="lg" variant="outline" disabled={source.busy || !value.trim()}>
        {source.addingUrl ? "Ajout…" : "Ajouter"}
      </Button>
    </form>
  );
}

/** Drop area for a file (click or drop) plus a field for a web link. */
function SourcePicker({ source, autoFocusUrl }: { source: AddSource; autoFocusUrl?: boolean }) {
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
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          dragging ? "border-foreground bg-card" : "border-input hover:border-foreground/40 hover:bg-card",
        )}
      >
        <span className="flex size-11 items-center justify-center rounded-full bg-card ring-1 ring-border">
          <FileUp className="size-5" />
        </span>
        {uploading ? (
          <>
            <p className="font-medium">Import en cours, {Math.round(progress ?? 0)} %</p>
            <Progress value={progress ?? 0} />
          </>
        ) : (
          <div className="space-y-1">
            <p className="text-lg font-medium tracking-[-0.01em]">Déposez un document ou un lien ici</p>
            <p className="text-sm text-muted-foreground">
              Devis, présentation, proposition… en PDF, 25 Mo maximum
            </p>
          </div>
        )}
        <FileInput inputRef={inputRef} onFile={(file) => void handleFile(file)} />
      </div>
      <UrlForm source={source} autoFocus={autoFocusUrl} />
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

/** Large drop zone, used when there is no document yet. */
export function UploadDropzone({ uploadPrefix }: { uploadPrefix: string }) {
  const source = useAddSource(uploadPrefix);
  usePasteToAdd(source);
  return <SourcePicker source={source} />;
}

/**
 * Header button once documents exist. The whole window still accepts a
 * dropped file or link, with a veil to show where it lands.
 */
export function UploadButton({ uploadPrefix }: { uploadPrefix: string }) {
  const [open, setOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const source = useAddSource(uploadPrefix, () => setOpen(false));
  const onDroppedFile = useEffectEvent((file: File) => void source.handleFile(file));
  const onDroppedUrl = useEffectEvent((url: string) => void source.handleUrl(url));
  // The dialog has its own drop zone and field
  usePasteToAdd(source, !open);

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
            <DialogTitle className="text-lg">Ajouter un document ou un lien</DialogTitle>
            <DialogDescription>
              Un PDF (devis, présentation, proposition…) ou une page web : Notion, Loom, Figma, Webflow, Google
              Slides…
            </DialogDescription>
          </DialogHeader>
          <SourcePicker source={source} autoFocusUrl />
        </DialogContent>
      </Dialog>
      {dragging && !open && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
          <p className="rounded-full bg-card px-5 py-2.5 text-[15px] font-medium shadow-lg">
            Déposez le fichier ou le lien pour l&apos;ajouter
          </p>
        </div>
      )}
    </>
  );
}
