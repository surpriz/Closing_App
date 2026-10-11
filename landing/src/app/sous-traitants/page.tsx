import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/components/links";
import { SUBPROCESSORS } from "@/components/subprocessors";

export const metadata: Metadata = {
  title: "Sous-traitants — Clozer",
  description: "Les prestataires qui traitent des données pour Clozer, et où.",
};

export default function Subprocessors() {
  return (
    <LegalPage title="Sous-traitants" updatedAt="11 octobre 2026">
      <p>
        Les prestataires ci-dessous traitent des données personnelles pour le compte de Clozer. Chacun est lié par un
        accord de traitement des données. Nous prévenons les clients par email au moins 30 jours avant d&apos;en ajouter
        un ; ils peuvent s&apos;y opposer en écrivant à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <div className="mt-8 space-y-6">
        {SUBPROCESSORS.map((sub) => (
          <div key={sub.name} className="border-t border-rule pt-5">
            <p className="!mt-0 font-semibold text-ink">{sub.name}</p>
            <p className="!mt-1">{sub.purpose}</p>
            <p className="!mt-1 text-sm">
              {sub.location} · {sub.safeguard}
            </p>
          </div>
        ))}
      </div>

      <p>
        Les outils que le vendeur branche lui-même (Slack, webhook, Calendly, Cal.com) ne sont pas nos sous-traitants :
        il les choisit et en répond comme responsable du traitement.
      </p>
    </LegalPage>
  );
}
