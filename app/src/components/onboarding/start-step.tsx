"use client";

import { BellRing, CalendarCheck, Check, Paperclip, PenLine, Users, Video } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { saveOfferDescription } from "@/app/bienvenue/actions";
import { UploadDropzone } from "@/components/dashboard/upload-dropzone";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { OFFER_DESCRIPTION_MAX, type MailTool } from "@/lib/onboarding";

import { IconRow, StepHeading } from "./parts";

const SEND: Record<MailTool, string> = {
  chrome: "Joignez votre PDF comme d'habitude : l'extension met le lien à sa place, et le deal démarre à l'envoi.",
  outlook_addin: "Joignez votre PDF comme d'habitude : le complément met le lien à sa place, et le deal démarre à l'envoi.",
  manual: "Déposez votre PDF dans Clozer, le lien est prêt aussitôt. Collez-le dans votre email à la place de la pièce jointe.",
};

// Optional extras, one line each: the seller finds them on the share screen
const EXTRAS = [
  { icon: Video, text: "Un mot d'accueil en vidéo ou en vocal, que le prospect voit dès l'ouverture." },
  { icon: Users, text: "Un lien pour plusieurs personnes (plaquette, post LinkedIn) : chaque lecteur devient un deal." },
  { icon: CalendarCheck, text: "Un bouton pour que le prospect prenne rendez-vous dans votre agenda." },
];

// The upload comes last: it leaves the tour as soon as a file is dropped
export function StartStep({ tool, askOffer, uploadPrefix }: { tool: MailTool; askOffer: boolean; uploadPrefix: string }) {
  return (
    <div className="space-y-10">
      <StepHeading title="C'est parti." lead="Au quotidien, vous vendez comme avant. Clozer fait le suivi." />
      <ol className="space-y-6">
        <IconRow icon={Paperclip} title="Vous envoyez votre proposition">
          {SEND[tool]}
        </IconRow>
        <IconRow icon={BellRing} title="Vous êtes prévenu quand votre prospect lit">
          {tool === "manual"
            ? "Par email, et en direct sur votre tableau de bord."
            : "Une alerte dans votre messagerie : c'est le bon moment pour appeler."}
        </IconRow>
        <IconRow icon={PenLine} title="Vous validez les relances">
          Clozer les écrit au bon moment. Vous les retrouvez dans « Relances à valider », rien ne part sans vous.
        </IconRow>
      </ol>
      <div className="space-y-3">
        <p className="text-small font-medium">À essayer aussi, depuis l&apos;écran de partage</p>
        <ul className="space-y-2">
          {EXTRAS.map(({ icon: Icon, text }) => (
            <li key={text} className="flex gap-2.5 text-small text-muted-foreground">
              <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
              {text}
            </li>
          ))}
        </ul>
        <p className="text-small text-muted-foreground">
          Envie du détail ?{" "}
          <Link href="/comment-ca-marche" className="underline underline-offset-4">
            Comment Clozer pense
          </Link>
          .
        </p>
      </div>
      {askOffer && <OfferField />}
      <UploadDropzone uploadPrefix={uploadPrefix} />
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
