import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/components/links";

export const metadata: Metadata = {
  title: "Mentions légales — Clozer",
  description: "Éditeur et hébergeur du site Clozer.",
};

// TODO before publishing: fill in the company details (Kbis) and have the page reviewed
export default function LegalNotice() {
  return (
    <LegalPage title="Mentions légales" updatedAt="11 octobre 2026">
      <h2>Éditeur</h2>
      <p>
        [Raison sociale], [forme juridique] au capital de [montant] €<br />
        Siège : [adresse]<br />
        RCS [ville] [numéro SIREN] · TVA intracommunautaire [numéro]<br />
        Contact : <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p>Directeur de la publication : [prénom nom], [fonction].</p>

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
