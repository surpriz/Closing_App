import { Eye, Link2, MailCheck } from "lucide-react";

import { IconRow, StepHeading } from "./parts";

export function PrincipleStep({ firstName }: { firstName: string | null }) {
  return (
    <div className="space-y-10">
      <StepHeading
        title={firstName ? `Bienvenue, ${firstName}.` : "Bienvenue sur Clozer."}
        lead="Deux minutes pour voir comment ça marche et brancher Clozer sur votre messagerie. Vous pourrez revoir ce guide quand vous voulez, depuis votre compte."
      />
      <ol className="space-y-6">
        <IconRow icon={Link2} title="Vous envoyez un lien, pas une pièce jointe">
          Votre devis ou votre présentation part comme d&apos;habitude, mais sous forme de lien Clozer. Un lien par
          prospect.
        </IconRow>
        <IconRow icon={Eye} title="Clozer voit comment votre prospect le lit">
          Quand il l&apos;ouvre, combien de temps sur chaque page, s&apos;il revient sur les tarifs, s&apos;il le fait
          suivre à un collègue. Vous êtes prévenu pendant qu&apos;il lit.
        </IconRow>
        <IconRow icon={MailCheck} title="Clozer prépare la bonne relance, vous validez">
          Au bon moment, avec les vrais chiffres de votre document. Rien ne part sans vous, sauf si vous activez le mode
          automatique.
        </IconRow>
      </ol>
    </div>
  );
}
