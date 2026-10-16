import type { Metadata } from "next";

import { LegalPage } from "@/components/legal-page";
import { CONTACT_EMAIL } from "@/components/links";

export const metadata: Metadata = {
  title: "Confidentialité — Clozer",
  description: "Quelles données Clozer traite, pourquoi, et comment exercer vos droits.",
};

// Keep in sync with the app: retention/purge.ts, tracking/request-context.ts, ai/provider.ts
export default function Privacy() {
  return (
    <LegalPage title="Confidentialité" updatedAt="13 octobre 2026">
      <p>
        Clozer permet à un vendeur d&apos;envoyer une proposition commerciale sous forme de lien, de voir comment elle
        est consultée et de relancer au bon moment. Cette page explique ce que nous collectons, dans quel but, combien
        de temps, et comment vous y opposer.
      </p>

      <h2>Vous avez reçu une proposition via Clozer</h2>
      <p>
        Le vendeur qui vous l&apos;a envoyée est responsable du traitement de vos données. Clozer agit pour son compte,
        comme sous-traitant. Le traitement repose sur son intérêt légitime à suivre une proposition qu&apos;il vous a
        adressée.
      </p>
      <p>Quand vous ouvrez le lien, nous enregistrons :</p>
      <ul>
        <li>votre adresse email et votre nom, si le lien vous les demande ou si le vendeur les a renseignés ;</li>
        <li>les pages consultées, le temps passé et la progression dans chacune, les visites successives ;</li>
        <li>
          votre localisation approximative (pays, région, ville et coordonnées approximatives) déduite de votre adresse
          IP, votre fuseau horaire et votre langue ;
        </li>
        <li>
          votre appareil, votre navigateur et son identifiant technique complet (user-agent), ainsi que la page
          d&apos;où vous venez. L&apos;adresse IP n&apos;est jamais conservée en clair, seulement sous forme
          d&apos;empreinte ;
        </li>
        <li>ce que vous écrivez à l&apos;assistant de la page, et ses réponses ;</li>
        <li>les commentaires vocaux que vous enregistrez, et leur transcription ;</li>
        <li>
          vos réponses : validation de la proposition (avec le nom saisi, l&apos;empreinte de l&apos;IP et le
          navigateur, comme preuve), demande d&apos;ajustement, prise de rendez-vous.
        </li>
      </ul>
      <p>
        À partir de ces éléments, Clozer calcule un niveau d&apos;intérêt et propose au vendeur le bon moment et le bon
        message pour vous recontacter. Une intelligence artificielle analyse pour cela votre lecture et vos messages.
        Aucune décision ne vous est imposée automatiquement : c&apos;est le vendeur qui décide de relancer.
      </p>
      <p>
        Ces informations servent uniquement au vendeur. Elles ne sont ni revendues, ni utilisées pour de la publicité.
        Chaque relance contient un lien de désinscription : un clic suffit pour ne plus en recevoir de ce vendeur.
      </p>

      <h2>Vous utilisez Clozer</h2>
      <p>
        Pour votre compte, Clozer est responsable du traitement. Nous conservons votre email, votre nom, vos documents
        et vos réglages afin de fournir le service (exécution du contrat), ainsi que les sessions de connexion
        (adresse IP et navigateur) pour la sécurité de votre compte. Vos documents sont stockés de façon privée et ne
        sont accessibles que par les liens que vous créez.
      </p>
      <p>
        Vous pouvez exporter les données de votre espace et supprimer votre compte ou votre espace depuis Réglages ›
        Données.
      </p>

      <h2>L&apos;extension Chrome et le complément Outlook</h2>
      <p>
        Ils n&apos;agissent que dans un email en cours de rédaction. Ils ne lisent pas vos emails reçus et
        n&apos;envoient pas le texte de vos messages à Clozer. Quand un PDF est remplacé par un lien (après votre accord
        dans Chrome, automatiquement dans Outlook sauf si vous activez « Me demander d&apos;abord »), ils envoient à
        Clozer ce PDF ainsi que l&apos;adresse et le nom du premier destinataire, pour créer le lien à son nom. Dans
        Outlook, à l&apos;envoi, le complément repère les liens Clozer présents dans l&apos;email pour les marquer comme
        envoyés.
      </p>
      <p>
        Ils interrogent Clozer régulièrement pour vous prévenir quand un prospect lit une de vos propositions. Ils
        gardent un jeton de connexion, révocable à tout moment dans les réglages de Clozer. Rien n&apos;est revendu ni
        utilisé pour de la publicité.
      </p>

      <h2>Intelligence artificielle</h2>
      <p>
        Clozer fait appel à Anthropic ou OpenAI pour lire les documents, répondre aux questions posées sur la page de
        lecture, rédiger les relances et analyser l&apos;avancement d&apos;un deal. Ces services reçoivent le texte du
        document, les messages, et un résumé de la lecture (pages, durées, appareil, pays), sans adresse email ni
        adresse IP. Les commentaires vocaux sont transcrits par OpenAI. Ces prestataires n&apos;utilisent pas les
        données transmises par API pour entraîner leurs modèles.
      </p>

      <h2>Cookies</h2>
      <ul>
        <li>
          <strong>Identifiant de lecture</strong> (12 mois) : un identifiant aléatoire qui permet de savoir que deux
          ouvertures viennent du même navigateur.
        </li>
        <li>
          <strong>Accès au document</strong> (30 jours) : retient l&apos;email saisi pour ne pas le redemander.
        </li>
        <li>
          <strong>Session</strong> : garde les utilisateurs de Clozer connectés.
        </li>
      </ul>
      <p>Aucun cookie publicitaire, aucun outil de mesure d&apos;audience, aucun traceur tiers.</p>

      <h2>Prestataires</h2>
      <p>
        Hébergement et base de données dans l&apos;Union européenne. La liste complète, avec la localisation de chacun,
        est sur la page <a href="/sous-traitants">sous-traitants</a>. Certains sont des sociétés américaines : les
        transferts sont encadrés par le Data Privacy Framework ou par les clauses contractuelles types de la
        Commission européenne.
      </p>
      <p>
        Si le vendeur a branché ses propres outils (Slack, webhook, Calendly, Cal.com), certaines informations leur
        sont transmises sous sa responsabilité, par exemple votre nom et votre email pour pré-remplir une prise de
        rendez-vous.
      </p>

      <h2>Durée de conservation</h2>
      <ul>
        <li>
          Données de lecture, messages, commentaires vocaux et relances : effacés automatiquement 12 mois après la
          dernière activité sur le lien.
        </li>
        <li>Preuve de validation d&apos;une proposition : 5 ans, durée de prescription commerciale.</li>
        <li>Documents supprimés par le vendeur : effacés définitivement, fichiers compris, après 30 jours.</li>
        <li>Compte vendeur : tant qu&apos;il est actif, effacé à sa suppression.</li>
      </ul>

      <h2>Vos droits</h2>
      <p>
        Vous pouvez accéder à vos données, les faire rectifier ou supprimer, vous opposer à leur traitement ou en
        demander la limitation. Si la demande concerne une proposition reçue, adressez-la au vendeur : il peut exporter
        ou effacer vos données directement. Vous pouvez aussi nous écrire à{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>, nous la transmettons au vendeur et vous répondons sous
        un mois.
      </p>
      <p>Vous pouvez aussi déposer une réclamation auprès de la CNIL (cnil.fr).</p>
    </LegalPage>
  );
}
