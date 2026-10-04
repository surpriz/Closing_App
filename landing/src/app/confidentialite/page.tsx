import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Confidentialité — Clozer",
  description: "Quelles données Clozer traite, pourquoi, et comment exercer vos droits.",
};

const UPDATED_AT = "27 septembre 2026";

export default function Privacy() {
  return (
    <div className="flex min-h-full flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-16 text-body text-ink-soft sm:px-6 md:py-20 [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-[-0.01em] [&_h2]:text-ink [&_li]:mt-2 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-5">
        <h1 className="text-title font-medium text-ink [font-stretch:92%]">
          Confidentialité
        </h1>
        <p>Mise à jour le {UPDATED_AT}.</p>

        <p>
          Clozer permet à un vendeur d&apos;envoyer une proposition commerciale sous forme
          de lien, de voir comment elle est consultée et de relancer au bon moment. Cette
          page explique ce que nous collectons, dans quel but, et comment vous y opposer.
        </p>

        <h2>Vous avez reçu une proposition via Clozer</h2>
        <p>
          Le vendeur qui vous l&apos;a envoyée est responsable du traitement de vos
          données. Clozer agit pour son compte, comme sous-traitant. Le traitement repose
          sur son intérêt légitime à suivre une proposition qu&apos;il vous a adressée.
        </p>
        <p>Quand vous ouvrez le lien, nous enregistrons :</p>
        <ul>
          <li>votre adresse email et votre nom, si le lien vous les demande ;</li>
          <li>
            les pages consultées, le temps passé sur chacune et la progression dans le
            document ;
          </li>
          <li>
            le type d&apos;appareil, le navigateur, le fuseau horaire, ainsi que la ville
            et le pays déduits de votre adresse IP. L&apos;adresse IP elle-même n&apos;est
            jamais conservée en clair, seulement sous forme d&apos;empreinte chiffrée ;
          </li>
          <li>
            vos réponses depuis la page : validation de la proposition ou demande
            d&apos;ajustement.
          </li>
        </ul>
        <p>
          Ces informations servent uniquement au vendeur : savoir si la proposition a été
          lue, et vous recontacter à un moment opportun, pendant vos heures de bureau. Elles
          ne sont ni revendues, ni utilisées pour de la publicité.
        </p>
        <p>
          Chaque email de relance contient un lien de désinscription. Un clic suffit pour
          ne plus recevoir de relances automatiques de ce vendeur.
        </p>

        <h2>Vous utilisez Clozer</h2>
        <p>
          Pour votre compte, Clozer est responsable du traitement. Nous conservons votre
          email, votre nom, vos documents et vos réglages, afin de fournir le service
          (exécution du contrat). Vos documents sont stockés de façon privée et ne sont
          accessibles que par les liens que vous créez.
        </p>

        <h2>Cookies</h2>
        <ul>
          <li>
            <strong>Identifiant de lecture</strong> (1 an) : un identifiant aléatoire, qui
            permet de savoir que deux ouvertures viennent du même navigateur.
          </li>
          <li>
            <strong>Accès au document</strong> (30 jours) : retient l&apos;email saisi pour
            ne pas le redemander.
          </li>
          <li>
            <strong>Session</strong> : garde les utilisateurs de Clozer connectés.
          </li>
        </ul>
        <p>Aucun cookie publicitaire, aucun traceur tiers.</p>

        <h2>Hébergement et prestataires</h2>
        <ul>
          <li>Vercel : hébergement de l&apos;application, stockage des documents à Paris.</li>
          <li>Neon : base de données (Francfort).</li>
          <li>Amazon Web Services (SES) : envoi des emails (Stockholm).</li>
          <li>
            OpenAI ou Anthropic, lorsque la rédaction assistée des relances est activée :
            le texte de la proposition leur est transmis pour rédiger le message, sans les
            données de lecture.
          </li>
        </ul>
        <p>
          Certains de ces prestataires sont des sociétés américaines. Les transferts
          éventuels sont encadrés par le Data Privacy Framework ou par les clauses
          contractuelles types de la Commission européenne.
        </p>

        <h2>Durée de conservation</h2>
        <p>
          Les données de lecture sont conservées tant que le compte du vendeur est actif.
          Elles sont supprimées avec son compte, ou plus tôt sur simple demande.
        </p>

        <h2>Vos droits</h2>
        <p>
          Vous pouvez accéder à vos données, les faire rectifier ou supprimer, vous opposer
          à leur traitement ou en demander la limitation. Écrivez à{" "}
          <a href="mailto:contact@clozer.club" className="text-ink underline underline-offset-2">
            contact@clozer.club
          </a>
          . Si la demande concerne une proposition reçue, nous la transmettons au vendeur
          concerné et vous répondons dans un délai d&apos;un mois.
        </p>
        <p>
          Vous pouvez aussi déposer une réclamation auprès de la CNIL (cnil.fr).
        </p>
      </main>

      <SiteFooter />
    </div>
  );
}
