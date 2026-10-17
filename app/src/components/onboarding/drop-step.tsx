"use client";

import { useTranslations } from "next-intl";

import { type AddedSource, UploadDropzone } from "@/components/dashboard/upload-dropzone";

import { ThermalPlate } from "@/components/brand/thermal-plate";

import { StepHeading } from "./parts";

export const SAMPLE_DOCUMENT = { url: "/onboarding/exemple-devis.pdf", name: "Devis exemple.pdf" };

export function DropStep({
  firstName,
  uploadPrefix,
  onCreated,
}: {
  firstName: string | null;
  uploadPrefix: string;
  onCreated: (added: AddedSource) => void;
}) {
  const t = useTranslations("onboarding.drop");
  return (
    <div className="space-y-8">
      <StepHeading
        title={firstName ? t("titleWithName", { firstName }) : t("title")}
        lead={t("lead")}
      />
      <p className="font-medium">{t("nothingToInstall")}</p>
      <figure className="flex items-center gap-4">
        <span aria-hidden className="grid w-40 shrink-0 grid-cols-6 gap-px">
          {Array.from({ length: 6 }, (_, i) => (
            <ThermalPlate key={i} heat={0} seed={i} className="aspect-[3/4]" />
          ))}
        </span>
        <figcaption className="text-small text-muted-foreground">
          {t("coldPages")}
        </figcaption>
      </figure>
      <UploadDropzone uploadPrefix={uploadPrefix} onCreated={onCreated} sample={SAMPLE_DOCUMENT} />
    </div>
  );
}
