import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

// Every line here must stay true in the app: check app/src (blob, links, rate-limit, auth, audit, retention)
// before changing it. Provider claims come from their own security pages (Vercel, Neon, AWS, Stripe).
export function SecurityFr() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <>
      <p>
        Vos propositions contiennent des prix, des conditions, parfois des informations sensibles sur vos clients.
        Cette page dit comment Clozer les protège, et aussi ce qu&apos;il ne fait pas encore. Pour un questionnaire
        de sécurité ou une question précise : {mail}.
      </p>

      <h2>Où sont vos données</h2>
      <ul>
        <li>Application hébergée chez Vercel, région de Paris.</li>
        <li>Base de données chez Neon, région de Francfort.</li>
        <li>Documents et enregistrements stockés chez Vercel, région de Paris.</li>
        <li>Emails envoyés par Amazon Web Services, région de Stockholm.</li>
      </ul>
      <p>
        Hors de l&apos;Union européenne : les fournisseurs d&apos;IA (Anthropic, OpenAI) reçoivent le texte des
        documents pour les lire et rédiger les relances, sans l&apos;email ni l&apos;adresse IP des lecteurs, et
        n&apos;entraînent pas leurs modèles avec. La liste complète, avec le pays et les garanties de chacun, est sur
        la page <Link href="/subprocessors">sous-traitants</Link>.
      </p>

      <h2>Chiffrement</h2>
      <ul>
        <li>Tous les échanges passent en HTTPS (TLS), imposé par le navigateur grâce à HSTS.</li>
        <li>Base de données et fichiers chiffrés au repos en AES-256 par nos hébergeurs.</li>
        <li>
          Les secrets que vous nous confiez (webhook Slack, clé de signature de vos webhooks, jetons Google) sont en
          plus chiffrés par l&apos;application, en AES-256-GCM.
        </li>
        <li>Les jetons de l&apos;extension Chrome et du complément Outlook ne sont stockés que sous forme d&apos;empreinte.</li>
      </ul>

      <h2>Vos documents et vos liens</h2>
      <ul>
        <li>
          Les PDF sont stockés en accès privé. Aucune adresse publique du fichier n&apos;existe : il passe par nos
          serveurs, qui vérifient à chaque ouverture que le lien est actif, pas expiré, pas retiré, et que
          l&apos;email a été donné si vous l&apos;avez demandé.
        </li>
        <li>Les documents ne sont ni mis en cache ni indexés par les moteurs de recherche.</li>
        <li>
          Chaque lien porte un identifiant aléatoire de 12 caractères (environ 71 bits) : impossible à deviner ou à
          parcourir.
        </li>
        <li>Retirer un lien ou le laisser expirer coupe l&apos;accès tout de suite, y compris aux copies transférées.</li>
        <li>À l&apos;envoi, chaque fichier est contrôlé : un vrai PDF, 25 Mo au plus.</li>
      </ul>

      <h2>Accès et isolation</h2>
      <ul>
        <li>Chaque espace est isolé : toutes les lectures et écritures sont filtrées par espace côté serveur.</li>
        <li>
          Trois rôles : propriétaire, administrateur, membre. Supprimer un document, exporter ou effacer des données
          est réservé aux administrateurs ; supprimer l&apos;espace, au propriétaire.
        </li>
        <li>
          Connexion sans mot de passe : un lien valable 5 minutes envoyé par email, ou votre compte Google. Session de
          7 jours. Les tentatives répétées sont bloquées.
        </li>
        <li>
          Les actions sensibles (équipe, exports, effacements, suppressions, connexion de l&apos;extension) sont
          inscrites dans un journal d&apos;audit, gardé 12 mois.
        </li>
      </ul>

      <h2>L&apos;application</h2>
      <ul>
        <li>En-têtes de sécurité (HSTS, protection contre l&apos;intégration dans un autre site, politique de contenu).</li>
        <li>
          Limites de requêtes sur les points d&apos;entrée publics (formulaire d&apos;email, Smart Link, ouverture des
          documents, envoi de fichiers, connexion), contre les robots et les essais à répétition.
        </li>
        <li>
          Vos webhooks sont signés (HMAC SHA-256) et ne partent jamais vers une adresse interne. Les webhooks reçus
          (Stripe, Amazon) sont vérifiés par leur signature.
        </li>
        <li>
          Dépendances surveillées en continu, analyse du code (CodeQL) et détection de secrets à chaque modification.
        </li>
      </ul>

      <h2>Données personnelles</h2>
      <ul>
        <li>L&apos;adresse IP des lecteurs n&apos;est jamais conservée en clair, seulement sous forme d&apos;empreinte.</li>
        <li>
          Les données de lecture sont effacées automatiquement 12 mois après la dernière activité d&apos;un lien ; un
          document supprimé disparaît pour de bon 30 jours après, fichiers compris.
        </li>
        <li>
          Vous exportez ou supprimez votre espace à tout moment, et répondez aux demandes d&apos;un prospect (export,
          effacement) depuis Réglages › Données.
        </li>
        <li>
          Le lecteur est informé sur la page de ce que vous voyez ; chaque relance contient un lien de désinscription.
        </li>
      </ul>
      <p>
        Le détail est dans la <Link href="/privacy">politique de confidentialité</Link> et l&apos;
        <Link href="/dpa">accord de traitement des données</Link>.
      </p>

      <h2>Sauvegardes et incidents</h2>
      <ul>
        <li>La base est sauvegardée en continu par Neon, avec restauration à un instant donné.</li>
        <li>
          En cas de violation de données, nous prévenons les clients concernés au plus tard 48 heures après en avoir
          eu connaissance, avec ce qu&apos;il faut pour leur propre déclaration à la CNIL.
        </li>
      </ul>

      <h2>Certifications</h2>
      <p>
        Clozer n&apos;a pas de certification propre (ISO 27001, SOC 2). Ses hébergeurs en ont : Vercel et Neon sont
        certifiés ISO 27001 et audités SOC 2 Type 2, comme Amazon Web Services ; les paiements passent par Stripe,
        certifié PCI DSS niveau 1. Clozer ne voit ni ne stocke jamais vos numéros de carte.
      </p>

      <h2>Ce que Clozer ne fait pas encore</h2>
      <ul>
        <li>
          L&apos;email demandé à l&apos;ouverture identifie le lecteur, il ne le vérifie pas : quelqu&apos;un qui reçoit le
          lien peut l&apos;ouvrir. Retirer le lien coupe son accès.
        </li>
        <li>Pas de mot de passe ni de filigrane sur les documents ; le lecteur peut télécharger le PDF.</li>
        <li>Pas de double authentification propre à Clozer. Avec la connexion Google, celle de votre compte Google s&apos;applique.</li>
      </ul>
      <p>Si l&apos;un de ces points compte pour vous, dites-le-nous : c&apos;est ce qui fixe nos priorités.</p>

      <h2>Signaler une faille</h2>
      <p>
        Vous pensez avoir trouvé une faille ? Écrivez à {mail}, sans exploiter la faille au-delà du nécessaire pour la
        montrer, ni toucher aux données d&apos;autres clients. Nous répondons sous 72 heures et ne poursuivrons pas une
        recherche menée de bonne foi.
      </p>
    </>
  );
}
