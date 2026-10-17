import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

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

      <h2>6. Term and termination</h2>
      <p>
        The Customer can delete their account or workspace at any time. We may suspend a workspace that breaches
        these terms, after a warning except in an emergency. When a workspace is deleted, its data and files are
        erased.
      </p>

      <h2>7. Changes</h2>
      <p>We notify the Customer by email at least 30 days before any significant change to these terms.</p>

      <h2>8. Governing law</h2>
      <p>
        French law. Failing an amicable settlement, the courts with jurisdiction over Romans-sur-Isère shall have
        jurisdiction.
      </p>

      <h2>Appendix: data processing agreement (Article 28 GDPR)</h2>
      <p>
        For prospect data, the Customer is the controller and Clozer its processor. This appendix forms part of the
        terms.
      </p>

      <h3>Subject matter and duration</h3>
      <p>
        Clozer processes the data needed to track the documents sent by the Customer (identity and contact details of
        recipients, reading data, approximate location, device, messages, voice comments, replies), for as long as the
        service is used. The data subjects are the recipients of the links.
      </p>

      <h3>Instructions</h3>
      <p>
        Clozer processes this data only on the Customer&apos;s instructions, as set out in these terms and in their
        settings. If an instruction appears to us to infringe the GDPR, we inform the Customer.
      </p>

      <h3>Confidentiality and security</h3>
      <ul>
        <li>Authorized personnel at Clozer are bound by confidentiality.</li>
        <li>
          Encrypted communications, documents stored with private access, IP addresses kept only as a hash, encrypted
          secrets, workspaces isolated from one another.
        </li>
        <li>Automatic deletion of reading data 12 months after a link&apos;s last activity.</li>
      </ul>

      <h3>Sub-processors</h3>
      <p>
        The Customer authorizes the providers listed on the <Link href="/subprocessors">subprocessors</Link> page. We
        notify them 30 days before any addition; they may object and, failing agreement, terminate. Each provider is
        bound by obligations equivalent to these.
      </p>

      <h3>Data subject rights</h3>
      <p>
        The Customer handles requests from their prospects, using the export and deletion available in Settings ›
        Data. If a request reaches us directly, we forward it to them without delay.
      </p>

      <h3>Data breaches</h3>
      <p>
        We notify the Customer of any personal data breach affecting them as soon as possible and no later than 48
        hours after becoming aware of it, with the information needed for their own notification to the CNIL.
      </p>

      <h3>Assistance and audit</h3>
      <p>
        We assist the Customer, to a reasonable extent, with their impact assessments and their dealings with the
        CNIL, and make available to them the information needed to demonstrate compliance with this agreement.
      </p>

      <h3>End of processing</h3>
      <p>
        When the workspace is deleted, the data is erased, files included. The Customer can export it beforehand.
        Only the data we are required by law to keep remains.
      </p>

      <p>Questions: {mail}.</p>
    </>
  );
}
