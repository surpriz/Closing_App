"use client";

import { type AddedSource, UploadDropzone } from "@/components/dashboard/upload-dropzone";

import { StepHeading } from "./parts";

export const SAMPLE_DOCUMENT = { url: "/onboarding/exemple-devis.pdf", name: "Devis exemple.pdf" };

export function DropStep({ uploadPrefix, onCreated }: { uploadPrefix: string; onCreated: (added: AddedSource) => void }) {
  return (
    <div className="space-y-8">
      <StepHeading
        title="Déposez un document que vous envoyez à vos prospects"
        lead="Un devis, une proposition, une plaquette. Le dernier que vous avez envoyé fait très bien l'affaire : personne ne le recevra pendant ce test."
      />
      <UploadDropzone uploadPrefix={uploadPrefix} onCreated={onCreated} sample={SAMPLE_DOCUMENT} />
    </div>
  );
}
