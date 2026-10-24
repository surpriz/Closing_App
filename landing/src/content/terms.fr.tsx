import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

import { DpaAnnexFr } from "./dpa-annex.fr";

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
      <DpaAnnexFr />

      <p>Questions : {mail}.</p>
    </>
  );
}
