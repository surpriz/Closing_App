import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

// Support URL of the Chrome Web Store listing and of the Outlook manifest (outlook/manifest/manifest.xml)
export function SupportFr() {
  return (
    <>
      <p>
        Une question, un bug, un lien qui ne s&apos;est pas créé : écrivez-nous à{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. On répond sous un jour ouvré.
      </p>

      <h2>Extension Chrome (Gmail et Outlook web)</h2>
      <ol>
        <li>
          Installez « Clozer » depuis le{" "}
          <a href="https://chromewebstore.google.com/detail/clozer/fnefeeodeepechnhbijpfmjjcolopmmj">
            Chrome Web Store
          </a>
          .
        </li>
        <li>
          Cliquez sur l&apos;icône Clozer dans Chrome, puis sur « Connecter Clozer ». Connectez-vous à Clozer si besoin.
        </li>
        <li>
          Joignez un PDF à un email dans Gmail ou Outlook web : Clozer propose de le remplacer par un lien au nom du
          destinataire.
        </li>
      </ol>
      <p>
        Pour la retirer : clic droit sur l&apos;icône Clozer › Supprimer de Chrome. La connexion se révoque aussi dans
        Clozer, Réglages › Chrome et Outlook.
      </p>

      <h2>Complément Outlook (Windows, Mac et web)</h2>
      <p>
        L&apos;administrateur Microsoft 365 de votre entreprise l&apos;installe pour toute l&apos;équipe : centre
        d&apos;administration › Paramètres › Applications intégrées › Charger des applications personnalisées, puis
        l&apos;adresse du manifeste :
      </p>
      <p>
        <code>https://app.clozer.club/outlook/manifest.xml</code>
      </p>
      <p>
        Le complément apparaît dans Outlook en quelques heures. Ouvrez-le depuis un email, cliquez sur « Connecter
        Clozer » et recopiez le code affiché dans Outlook sur la page Clozer qui s&apos;ouvre dans votre navigateur.
      </p>
      <p>
        Le complément fonctionne avec les comptes Microsoft 365, Exchange et Outlook.com. Microsoft ne permet pas
        d&apos;ajouter un complément à une boîte connectée en IMAP ou POP (une adresse sur votre propre nom de domaine
        hébergée ailleurs, par exemple).
      </p>

      <h2>Vos données</h2>
      <p>
        Ce que l&apos;extension et le complément envoient à Clozer est décrit dans la page{" "}
        <Link href="/privacy">confidentialité</Link>.
      </p>
    </>
  );
}
