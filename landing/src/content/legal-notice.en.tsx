import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

// Translation of legal-notice.fr.tsx, which prevails. Company identifiers stay as registered.
export function LegalNoticeEn() {
  return (
    <>
      <h2>Publisher</h2>
      <p>
        JAAP v2, SASU with a share capital of €500
        <br />
        Registered office: 155 chemin des Écureuils, 26450 Charols, France
        <br />
        945 292 795 R.C.S. Romans · EU VAT number FR74945292795
        <br />
        Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p>Publication director: Jérôme Laval, president.</p>

      <h2>Host</h2>
      <p>
        Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, United States.
        <br />
        Application and files hosted in the European Union (Paris region).
      </p>

      <h2>Intellectual property</h2>
      <p>
        The texts, logos and graphic elements of the site belong to the publisher. Any reproduction without written
        consent is prohibited.
      </p>

      <h2>Personal data</h2>
      <p>
        See the <Link href="/privacy">privacy policy</Link> and the{" "}
        <Link href="/subprocessors">list of subprocessors</Link>.
      </p>
    </>
  );
}
