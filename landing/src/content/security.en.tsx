import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

// Translation of security.fr.tsx, which prevails. Same rule: every line must stay true in the app.
export function SecurityEn() {
  const mail = <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;

  return (
    <>
      <p>
        Your proposals hold prices, terms and sometimes sensitive details about your customers. This page says how
        Clozer protects them, and also what it does not do yet. For a security questionnaire or a specific question:{" "}
        {mail}.
      </p>

      <h2>Where your data lives</h2>
      <ul>
        <li>Application hosted by Vercel, Paris region.</li>
        <li>Database at Neon, Frankfurt region.</li>
        <li>Documents and recordings stored by Vercel, Paris region.</li>
        <li>Emails sent by Amazon Web Services, Stockholm region.</li>
      </ul>
      <p>
        Outside the European Union: the AI providers (Anthropic, OpenAI) receive the text of documents to read them
        and draft follow-ups, without the readers&apos; email or IP address, and do not train their models on it. The
        full list, with each provider&apos;s country and safeguards, is on the{" "}
        <Link href="/subprocessors">subprocessors</Link> page.
      </p>

      <h2>Encryption</h2>
      <ul>
        <li>All traffic goes over HTTPS (TLS), enforced by the browser through HSTS.</li>
        <li>Database and files encrypted at rest with AES-256 by our hosting providers.</li>
        <li>
          Secrets you give us (Slack webhook, your webhooks&apos; signing key, Google tokens) are also encrypted by the
          application, with AES-256-GCM.
        </li>
        <li>Tokens of the Chrome extension and the Outlook add-in are only stored as a hash.</li>
      </ul>

      <h2>Your documents and links</h2>
      <ul>
        <li>
          PDFs are stored with private access. No public address of the file exists: it goes through our servers,
          which check on every opening that the link is active, not expired, not withdrawn, and that the email was
          given if you asked for it.
        </li>
        <li>Documents are neither cached nor indexed by search engines.</li>
        <li>Each link carries a random 12-character identifier (about 71 bits): it cannot be guessed or enumerated.</li>
        <li>Withdrawing a link or letting it expire cuts access at once, forwarded copies included.</li>
        <li>Every uploaded file is checked: a real PDF, 25 MB at most.</li>
      </ul>

      <h2>Access and isolation</h2>
      <ul>
        <li>Each workspace is isolated: every read and write is filtered by workspace on the server.</li>
        <li>
          Three roles: owner, admin, member. Deleting a document, exporting or erasing data is for admins; deleting
          the workspace, for the owner.
        </li>
        <li>
          Passwordless sign-in: a link valid for 5 minutes sent by email, or your Google account. 7-day sessions.
          Repeated attempts are blocked.
        </li>
        <li>
          Sensitive actions (team, exports, erasures, deletions, extension sign-in) are written to an audit log, kept
          for 12 months.
        </li>
      </ul>

      <h2>The application</h2>
      <ul>
        <li>Security headers (HSTS, protection against framing by other sites, content policy).</li>
        <li>
          Request limits on public entry points (email form, Smart Link, document opening, uploads, sign-in), against
          bots and repeated attempts.
        </li>
        <li>
          Your webhooks are signed (HMAC SHA-256) and never go to an internal address. Incoming webhooks (Stripe,
          Amazon) are checked by their signature.
        </li>
        <li>Dependencies monitored continuously, code analysis (CodeQL) and secret detection on every change.</li>
      </ul>

      <h2>Personal data</h2>
      <ul>
        <li>Readers&apos; IP addresses are never kept in clear, only as a hash.</li>
        <li>
          Reading data is erased automatically 12 months after a link&apos;s last activity; a deleted document is gone
          for good 30 days later, files included.
        </li>
        <li>
          You export or delete your workspace at any time, and answer a prospect&apos;s requests (export, erasure) from
          Settings › Data.
        </li>
        <li>The reader is told on the page what you see; every follow-up carries an unsubscribe link.</li>
      </ul>
      <p>
        Details are in the <Link href="/privacy">privacy policy</Link> and the{" "}
        <Link href="/dpa">data processing agreement</Link>.
      </p>

      <h2>Backups and incidents</h2>
      <ul>
        <li>The database is backed up continuously by Neon, with point-in-time restore.</li>
        <li>
          In case of a data breach, we notify the customers concerned no later than 48 hours after becoming aware of
          it, with what they need for their own notification to the authority.
        </li>
      </ul>

      <h2>Certifications</h2>
      <p>
        Clozer holds no certification of its own (ISO 27001, SOC 2). Its hosting providers do: Vercel and Neon are ISO
        27001 certified and SOC 2 Type 2 audited, as is Amazon Web Services; payments go through Stripe, PCI DSS Level
        1 certified. Clozer never sees or stores your card numbers.
      </p>

      <h2>What Clozer does not do yet</h2>
      <ul>
        <li>
          The email asked for on opening identifies the reader, it does not verify them: someone who receives the link
          can open it. Withdrawing the link cuts their access.
        </li>
        <li>No password or watermark on documents; the reader can download the PDF.</li>
        <li>No two-factor authentication of Clozer&apos;s own. With Google sign-in, your Google account&apos;s applies.</li>
      </ul>
      <p>If one of these matters to you, tell us: that is what sets our priorities.</p>

      <h2>Reporting a vulnerability</h2>
      <p>
        Think you found a vulnerability? Write to {mail}, without exploiting it beyond what is needed to show it, and
        without touching other customers&apos; data. We answer within 72 hours and will not pursue research done in
        good faith.
      </p>
    </>
  );
}
