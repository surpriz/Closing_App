import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/components/links";

export const metadata: Metadata = {
  title: "Mentions légales — Clozer",
  description: "Éditeur et hébergeur du site Clozer.",
};

export default function LegalNotice() {
  return (
    <LegalPage title="Mentions légales" updatedAt="16 octobre 2026">
      <h2>Éditeur</h2>
      <p>
        JAAP v2, SASU au capital de 500 €<br />
        Siège : 155 chemin des Écureuils, 26450 Charols<br />
        945 292 795 R.C.S. Romans · TVA intracommunautaire FR74945292795<br />
        Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p>Directeur de la publication : Jérôme Laval, président.</p>

      <h2>Hébergeur</h2>
      <p>
        Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis.
        <br />
        Application et fichiers hébergés dans l&apos;Union européenne (région de Paris).
      </p>

      <h2>Propriété intellectuelle</h2>
      <p>
        Les textes, logos et éléments graphiques du site appartiennent à l&apos;éditeur. Toute reproduction sans
        accord écrit est interdite.
      </p>

      <h2>Données personnelles</h2>
      <p>
        Voir la <a href="/confidentialite">politique de confidentialité</a> et la{" "}
        <a href="/sous-traitants">liste des sous-traitants</a>.
      </p>
    </LegalPage>
  );
}
