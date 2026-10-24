import { Link } from "@/i18n/navigation";

// The data processing agreement: appendix of the terms, and its own page (/dpa) for customers who sign it apart
export function DpaAnnexFr() {
  return (
    <>
      <p>
        Pour les données des prospects, le Client est responsable du traitement et Clozer son sous-traitant. Cette
        annexe fait partie des conditions.
      </p>

      <h3>Objet et durée</h3>
      <p>
        Clozer traite les données nécessaires au suivi des documents envoyés par le Client (identité et coordonnées
        des destinataires, données de lecture, localisation approximative, appareil, messages, commentaires vocaux,
        réponses), pour la durée d&apos;utilisation du service. Les personnes concernées sont les destinataires des
        liens.
      </p>

      <h3>Instructions</h3>
      <p>
        Clozer ne traite ces données que sur instruction du Client, telles qu&apos;elles résultent de ces conditions et
        de ses réglages. Si une instruction nous paraît contraire au RGPD, nous l&apos;en informons.
      </p>

      <h3>Confidentialité et sécurité</h3>
      <ul>
        <li>Les personnes habilitées chez Clozer sont tenues à la confidentialité.</li>
        <li>
          Chiffrement des échanges, documents stockés en accès privé, adresses IP conservées sous forme
          d&apos;empreinte, secrets chiffrés, isolation des espaces entre eux.
        </li>
        <li>Effacement automatique des données de lecture 12 mois après la dernière activité d&apos;un lien.</li>
      </ul>

      <h3>Sous-traitants ultérieurs</h3>
      <p>
        Le Client autorise les prestataires listés sur la page <Link href="/subprocessors">sous-traitants</Link>. Nous le
        prévenons 30 jours avant tout ajout ; il peut s&apos;y opposer et, à défaut d&apos;accord, résilier. Chaque
        prestataire est tenu par des obligations équivalentes à celles-ci.
      </p>

      <h3>Droits des personnes</h3>
      <p>
        Le Client répond aux demandes de ses prospects, avec l&apos;export et l&apos;effacement disponibles dans
        Réglages › Données. Si une demande nous parvient directement, nous la lui transmettons sans délai.
      </p>

      <h3>Violation de données</h3>
      <p>
        Nous notifions au Client toute violation de données le concernant dans les meilleurs délais et au plus tard
        48 heures après en avoir eu connaissance, avec les informations utiles à sa propre notification à la CNIL.
      </p>

      <h3>Assistance et audit</h3>
      <p>
        Nous aidons le Client, dans la mesure du raisonnable, pour ses analyses d&apos;impact et ses échanges avec la
        CNIL, et mettons à sa disposition les informations nécessaires pour démontrer le respect de cet accord.
      </p>

      <h3>Fin du traitement</h3>
      <p>
        À la suppression de l&apos;espace, les données sont effacées, fichiers compris. Le Client peut les exporter
        avant. Seules restent les données que la loi nous oblige à garder.
      </p>
    </>
  );
}
