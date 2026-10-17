import { CONTACT_EMAIL } from "@/components/links";
import { SUBPROCESSORS } from "@/components/subprocessors";

export function SubprocessorsFr() {
  return (
    <>
      <p>
        Les prestataires ci-dessous traitent des données personnelles pour le compte de Clozer. Chacun est lié par un
        accord de traitement des données. Nous prévenons les clients par email au moins 30 jours avant d&apos;en ajouter
        un ; ils peuvent s&apos;y opposer en écrivant à <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>

      <div className="mt-8 space-y-6">
        {SUBPROCESSORS.map((sub) => (
          <div key={sub.name} className="border-t border-rule pt-5">
            <p className="!mt-0 font-semibold text-ink">{sub.name}</p>
            <p className="!mt-1">{sub.purpose.fr}</p>
            <p className="!mt-1 text-sm">
              {sub.location.fr} · {sub.safeguard.fr}
            </p>
          </div>
        ))}
      </div>

      <p>
        Les outils que le vendeur branche lui-même (Slack, webhook, Calendly, Cal.com) ne sont pas nos sous-traitants :
        il les choisit et en répond comme responsable du traitement.
      </p>
    </>
  );
}
