import { BellRing, Eye, Link2 } from "lucide-react";

import { IconRow, StepHeading } from "./parts";

export function ValueStep({ firstName }: { firstName: string | null }) {
  return (
    <div className="space-y-10">
      <StepHeading
        title={firstName ? `Bienvenue, ${firstName}.` : "Bienvenue sur Clozer."}
        lead="Deux minutes pour voir ce que Clozer fait pour vous. On le fait ensemble, avec un de vos documents."
      />
      <ol className="space-y-6">
        <IconRow icon={Link2} title="Vous envoyez un lien au lieu du PDF">
          Votre devis ou votre proposition devient une page web. Votre prospect l&apos;ouvre comme un PDF, sans
          rien installer.
        </IconRow>
        <IconRow icon={Eye} title="Vous voyez ce qu'il en fait">
          S&apos;il l&apos;a ouvert, quelles pages, combien de temps, s&apos;il est revenu sur les tarifs.
        </IconRow>
        <IconRow icon={BellRing} title="Clozer vous dit qui relancer">
          Au bon moment, avec le message déjà écrit. Vous validez, rien ne part sans vous.
        </IconRow>
      </ol>
      <p className="rounded-xl bg-foreground/[0.04] px-4 py-3 text-body">
        <span className="font-medium">Rien à installer.</span> Tout se fait ici, dans votre navigateur.
      </p>
    </div>
  );
}
