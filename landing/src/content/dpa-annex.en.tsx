import { Link } from "@/i18n/navigation";

// Translation of dpa-annex.fr.tsx, which prevails
export function DpaAnnexEn() {
  return (
    <>
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
    </>
  );
}
