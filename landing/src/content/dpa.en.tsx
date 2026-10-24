import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

import { DpaAnnexEn } from "./dpa-annex.en";

// Translation of dpa.fr.tsx, which prevails
export function DpaEn() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <>
      <p>
        This agreement is the appendix of the <Link href="/terms">terms of use</Link>. It applies as soon as a
        workspace is created, with nothing to do. If your company needs a signed copy, write to {mail}.
      </p>

      <DpaAnnexEn />

      <p>
        Security measures are detailed on the <Link href="/security">security</Link> page. Questions: {mail}.
      </p>
    </>
  );
}
