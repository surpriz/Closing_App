"use client";

import { upload } from "@vercel/blob/client";
import { FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type DragEvent } from "react";
import { toast } from "sonner";

import { createDocument } from "@/app/(dashboard)/documents/actions";
import { MAX_UPLOAD_BYTES } from "@/lib/closing/constants";

function safeFileName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-120);
}

export function UploadDropzone({ uploadPrefix }: { uploadPrefix: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
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
      toast.success("Document importé, analyse en cours.");
      router.push(`/documents/${id}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "L'import a échoué.");
      setProgress(null);
    }
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) void handleFile(file);
  }

  const uploading = progress !== null;

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
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
        dragging ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-muted/50"
      }`}
    >
      <FileUp className="size-8 text-muted-foreground" />
      {uploading ? (
        <>
          <p className="text-sm font-medium">Import en cours… {Math.round(progress)} %</p>
          <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </>
      ) : (
        <>
          <p className="text-sm font-medium">Glissez un devis PDF ici</p>
          <p className="text-xs text-muted-foreground">ou cliquez pour choisir un fichier · 25 Mo max</p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
