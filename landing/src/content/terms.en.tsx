import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

import { DpaAnnexEn } from "./dpa-annex.en";

// Translation of terms.fr.tsx, which prevails. Same draft status, same bracketed fields from the Kbis.
export function TermsEn() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <>
      <p>
        These terms govern the use of Clozer, a service published by JAAP v2 (&ldquo;Clozer&rdquo;), by the
        professionals who create a workspace (&ldquo;the Customer&rdquo;) and the people they invite to it. Creating
        an account constitutes acceptance.
      </p>

      <h2>1. The service</h2>
      <p>
        Clozer turns sales documents into tracked links, informs the Customer of how they are read and helps them
        follow up with their prospects. Some features rely on artificial intelligence; their suggestions are aids, and
        the Customer remains the sole judge of what they send.
      </p>

      <h2>2. Account and access</h2>
      <p>
        The Customer keeps their access credentials confidential and is responsible for the use of their workspace by
        its members. They provide accurate information and notify us without delay of any unauthorized access.
      </p>

      <h2>3. Permitted use</h2>
      <ul>
        <li>Clozer is intended for business communications between professionals.</li>
        <li>
          The Customer only sends a link to people with whom they have a legitimate reason to communicate, and honors
          their objection requests.
        </li>
        <li>
          Prohibited: unlawful content, health data or other sensitive data, spam, circumvention of the technical
          limits of the service.
        </li>
      </ul>

      <h2>4. Customer content</h2>
      <p>
        The Customer remains the owner of their documents and of their prospects&apos; data. They grant Clozer only
        the right to process them in order to provide the service. They can export and delete them at any time from
        Settings › Data.
      </p>

      <h2>5. Availability and liability</h2>
      <p>
        We do our best to keep the service available and secure, without any guarantee that it will be
        uninterrupted. Our liability is limited to direct damages and capped at the amounts paid by the Customer over
        the last twelve months.
      </p>

      <h2>6. Paid plans</h2>
      <p>
        Prices are shown excluding VAT on the <Link href="/pricing">pricing</Link> page; VAT is added depending on the
        Customer&apos;s country. The subscription is paid by card and renews every month or every year, as the
        Customer chooses. It can be cancelled at any time from the billing settings: cancellation takes effect at the
        end of the current period, and a period already started is not refunded. A change of plan or of the number of
        members is prorated.
      </p>

      <h2>7. Term and termination</h2>
      <p>
        The Customer can delete their account or workspace at any time. We may suspend a workspace that breaches
        these terms, after a warning except in an emergency. When a workspace is deleted, its data and files are
        erased.
      </p>

      <h2>8. Changes</h2>
      <p>We notify the Customer by email at least 30 days before any significant change to these terms.</p>

      <h2>9. Governing law</h2>
      <p>
        French law. Failing an amicable settlement, the courts with jurisdiction over Romans-sur-Isère shall have
        jurisdiction.
      </p>

      <h2>Appendix: data processing agreement (Article 28 GDPR)</h2>
      <DpaAnnexEn />

      <p>Questions: {mail}.</p>
    </>
  );
}
