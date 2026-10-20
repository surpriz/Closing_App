import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

// Support URL of the Chrome Web Store listing and of the Outlook manifest (outlook/manifest/manifest.xml)
export function SupportEn() {
  return (
    <>
      <p>
        A question, a bug, a link that didn&apos;t get created: email us at{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We reply within one business day.
      </p>

      <h2>Chrome extension (Gmail and Outlook on the web)</h2>
      <ol>
        <li>
          Install &ldquo;Clozer&rdquo; from the{" "}
          <a href="https://chromewebstore.google.com/detail/clozer/fnefeeodeepechnhbijpfmjjcolopmmj">
            Chrome Web Store
          </a>
          .
        </li>
        <li>
          Click the Clozer icon in Chrome, then &ldquo;Connect Clozer&rdquo;. Sign in to Clozer if needed.
        </li>
        <li>
          Attach a PDF to an email in Gmail or Outlook on the web: Clozer offers to replace it with a link in the
          recipient&apos;s name.
        </li>
      </ol>
      <p>
        Chrome says &ldquo;Not trusted by Enhanced Safe Browsing&rdquo;? That&apos;s normal for a new publisher: the
        extension was reviewed by Google and is published on the Chrome Web Store. The message will go away on its own,
        and it only shows if you turned on Enhanced protection.
      </p>
      <p>
        To remove it: right-click the Clozer icon › Remove from Chrome. You can also revoke the connection in Clozer,
        Settings › Chrome and Outlook.
      </p>

      <h2>Outlook add-in (Windows, Mac and web)</h2>
      <p>
        Your company&apos;s Microsoft 365 admin installs it for the whole team: admin center › Settings › Integrated
        apps › Upload custom apps, then the manifest URL:
      </p>
      <p>
        <code>https://app.clozer.club/outlook/manifest.xml</code>
      </p>
      <p>
        The add-in shows up in Outlook within a few hours. Open it from an email, click &ldquo;Connect Clozer&rdquo;
        and enter the code shown in Outlook on the Clozer page that opens in your browser.
      </p>
      <p>
        The add-in works with Microsoft 365, Exchange and Outlook.com accounts. Microsoft doesn&apos;t allow add-ins
        on mailboxes connected over IMAP or POP (an address on your own domain hosted elsewhere, for example).
      </p>

      <h2>Your data</h2>
      <p>
        What the extension and the add-in send to Clozer is described on the <Link href="/privacy">privacy</Link>{" "}
        page.
      </p>
    </>
  );
}
