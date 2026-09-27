"use client";

import { upload } from "@vercel/blob/client";
import { FileUp, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { createDocument } from "@/app/(dashboard)/documents/actions";
import { Button } from "@/components/ui/button";
import { MAX_UPLOAD_BYTES } from "@/lib/closing/constants";
import { cn } from "cn";

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-120);
}

function useUpload(uploadPrefix: string) {
  const router = useRouter();
  const [progress, setProgress] = useState<number | null>(null);

  async function handleFile(file: File) {
    if (file.type !== "application/pdf") {
      toast.error("Seuls les fichiers PDF sont acceptés.");
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
      toast.success("Devis importé, analyse en cours.");
      router.push(`/documents/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'import a échoué.");
      setProgress(null);
    }
  }

  return { progress, uploading: progress !== null, handleFile };
}

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

/** Large drop zone, used when there is no quote yet. */
export function UploadDropzone({ uploadPrefix }: { uploadPrefix: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { progress, uploading, handleFile } = useUpload(uploadPrefix);

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !uploading && inputRef.current?.click()}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !uploading) inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
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
          <p className="text-lg font-medium tracking-[-0.01em]">Déposez votre devis ici</p>
          <p className="text-sm text-muted-foreground">ou cliquez pour choisir un PDF, 25 Mo maximum</p>
        </div>
      )}
      <FileInput inputRef={inputRef} onFile={(file) => void handleFile(file)} />
    </div>
  );
}

/**
 * Header button once quotes exist. The whole window still accepts a dropped
 * PDF, with a veil to show where it lands.
 */
export function UploadButton({ uploadPrefix }: { uploadPrefix: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const { progress, uploading, handleFile } = useUpload(uploadPrefix);
  const onDroppedFile = useEffectEvent((file: File) => void handleFile(file));

  useEffect(() => {
    let depth = 0;
    const hasFiles = (e: globalThis.DragEvent) => e.dataTransfer?.types.includes("Files");
    const onEnter = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      depth += 1;
      setDragging(true);
    };
    const onLeave = () => {
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    };
    const onOver = (e: globalThis.DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    };
    const onDrop = (e: globalThis.DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      setDragging(false);
      const file = e.dataTransfer?.files[0];
      if (file) onDroppedFile(file);
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
      <Button size="lg" disabled={uploading} onClick={() => inputRef.current?.click()}>
        <Plus />
        {uploading ? `Import, ${Math.round(progress ?? 0)} %` : "Importer un devis"}
      </Button>
      <FileInput inputRef={inputRef} onFile={(file) => void handleFile(file)} />
      {dragging && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
          <p className="rounded-full bg-card px-5 py-2.5 text-[15px] font-medium shadow-lg">
            Déposez le PDF pour l&apos;importer
          </p>
        </div>
      )}
    </>
  );
}
