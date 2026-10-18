import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

// Draft: to be reviewed by a lawyer before it binds anyone. Bracketed fields come from the Kbis.
export function TermsFr() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <>
      <p>
        Ces conditions encadrent l&apos;utilisation de Clozer, service édité par JAAP v2 (« Clozer »), par
        les professionnels qui créent un espace (« le Client ») et les personnes qu&apos;ils y invitent. Créer un
        compte vaut acceptation.
      </p>

      <h2>1. Le service</h2>
      <p>
        Clozer transforme des documents commerciaux en liens suivis, informe le Client de leur lecture et l&apos;aide à
        relancer ses prospects. Certaines fonctions reposent sur l&apos;intelligence artificielle ; leurs suggestions
        sont des aides, le Client reste seul juge de ce qu&apos;il envoie.
      </p>

      <h2>2. Compte et accès</h2>
      <p>
        Le Client garde ses accès confidentiels et répond de l&apos;usage de son espace par ses membres. Il fournit des
        informations exactes et nous prévient sans délai de tout accès non autorisé.
      </p>

      <h2>3. Usage autorisé</h2>
      <ul>
        <li>Clozer sert à des échanges commerciaux entre professionnels.</li>
        <li>
          Le Client n&apos;envoie un lien qu&apos;à des personnes avec qui il a un motif légitime d&apos;échanger, et
          respecte leurs demandes d&apos;opposition.
        </li>
        <li>
          Interdits : contenus illicites, données de santé ou autres données sensibles, spam, contournement des limites
          techniques du service.
        </li>
      </ul>

      <h2>4. Contenus du Client</h2>
      <p>
        Le Client reste propriétaire de ses documents et des données de ses prospects. Il accorde à Clozer le seul
        droit de les traiter pour fournir le service. Il peut les exporter et les supprimer à tout moment depuis
        Réglages › Données.
      </p>

      <h2>5. Disponibilité et responsabilité</h2>
      <p>
        Nous faisons notre possible pour que le service soit disponible et sûr, sans garantie d&apos;absence
        d&apos;interruption. Notre responsabilité est limitée aux dommages directs et plafonnée aux sommes versées par le
        Client sur les douze derniers mois.
      </p>

      <h2>6. Offres payantes</h2>
      <p>
        Les prix sont affichés hors taxes sur la page <Link href="/pricing">tarifs</Link> ; la TVA s&apos;ajoute selon le
        pays du Client. L&apos;abonnement se paie par carte et se renouvelle chaque mois ou chaque année, selon le
        choix du Client. Il peut être résilié à tout moment depuis les réglages de facturation : la résiliation prend
        effet à la fin de la période en cours, et une période commencée n&apos;est pas remboursée. Un changement
        d&apos;offre ou du nombre de membres est calculé au prorata.
      </p>

      <h2>7. Durée et fin</h2>
      <p>
        Le Client peut supprimer son compte ou son espace à tout moment. Nous pouvons suspendre un espace qui enfreint
        ces conditions, après avertissement sauf urgence. À la suppression d&apos;un espace, ses données et fichiers
        sont effacés.
      </p>

      <h2>8. Modifications</h2>
      <p>
        Nous prévenons le Client par email au moins 30 jours avant tout changement important de ces conditions.
      </p>

      <h2>9. Droit applicable</h2>
      <p>Droit français. À défaut d&apos;accord amiable, tribunaux compétents du ressort de Romans-sur-Isère.</p>

      <h2>Annexe : accord de traitement des données (article 28 du RGPD)</h2>
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

      <p>Questions : {mail}.</p>
    </>
  );
}
