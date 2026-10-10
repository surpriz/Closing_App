"use client";

import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveOfferDescription } from "@/app/bienvenue/actions";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OFFER_DESCRIPTION_MAX } from "@/lib/onboarding";

import { StepHeading } from "./parts";

export function StartStep({
  askOffer,
  hasDocument,
  uploadPrefix,
}: {
  askOffer: boolean;
  hasDocument: boolean;
  uploadPrefix: string;
}) {
  return (
    <div className="space-y-10">
      <StepHeading
        title="C'est parti."
        lead={
          hasDocument
            ? "Votre espace a déjà des documents. Créez un lien par prospect depuis l'un d'eux, ou depuis votre messagerie."
            : "Ajoutez votre premier document : un devis, une proposition ou une présentation. Clozer le lit en quelques secondes."
        }
      />
      {askOffer && <OfferField />}
      {!hasDocument && <UploadDropzone uploadPrefix={uploadPrefix} />}
    </div>
  );
}

// Optional: Clozer guesses the offer from the first document otherwise
function OfferField() {
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function save() {
    startTransition(async () => {
      const result = await saveOfferDescription(value);
      if (result.ok) setSaved(true);
      else toast.error("Impossible d'enregistrer. Vous pourrez le faire dans les réglages.");
    });
  }

  if (saved) {
    return (
      <p className="flex items-center gap-2 text-body text-muted-foreground">
        <Check className="size-4 text-success" aria-hidden />
        Offre enregistrée. Vous pourrez la compléter dans les réglages.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="offer">
        Ce que vous vendez <span className="font-normal text-muted-foreground">(facultatif)</span>
      </Label>
      <Textarea
        id="offer"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        maxLength={OFFER_DESCRIPTION_MAX}
        rows={3}
        placeholder="Ex. : un logiciel de planning pour les cabinets d'architectes, de 200 à 800 € par mois."
      />
      <div className="flex items-center justify-between gap-4">
        <p className="text-small text-muted-foreground">
          Clozer s&apos;en sert pour écrire vos relances. Laissé vide, il déduit votre offre de votre premier document.
        </p>
        <Button variant="outline" size="sm" disabled={pending || !value.trim()} onClick={save}>
          Enregistrer
        </Button>
      </div>
    </div>
  );
}
