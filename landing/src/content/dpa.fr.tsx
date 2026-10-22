import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

import { DpaAnnexFr } from "./dpa-annex.fr";

// Same text as the appendix of the terms: one source, dpa-annex.fr.tsx
export function DpaFr() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <>
      <p>
        Cet accord est l&apos;annexe des <Link href="/terms">conditions d&apos;utilisation</Link>. Il s&apos;applique
        dès la création d&apos;un espace, sans démarche. Si votre entreprise a besoin d&apos;un exemplaire signé,
        écrivez à {mail}.
      </p>

      <DpaAnnexFr />

      <p>
        Les mesures de sécurité sont détaillées sur la page <Link href="/security">sécurité</Link>. Questions : {mail}.
      </p>
    </>
  );
}
