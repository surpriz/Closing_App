import { CONTACT_EMAIL } from "@/components/links";
import { Link } from "@/i18n/navigation";

// Translation of privacy.fr.tsx, which prevails. Keep in sync with the app: retention/purge.ts,
// tracking/request-context.ts, ai/provider.ts
export function PrivacyEn() {
  return (
    <>
      <p>
        Clozer lets a seller send a sales proposal as a link, see how it is viewed and follow up at the right time.
        This page explains what we collect, for what purpose, for how long, and how to object.
      </p>

      <h2>You received a proposal through Clozer</h2>
      <p>
        The seller who sent it to you is the controller of your data. Clozer acts on their behalf, as a processor.
        The processing is based on their legitimate interest in following up on a proposal they sent you.
      </p>
      <p>When you open the link, we record:</p>
      <ul>
        <li>your email address and name, if the link asks for them or if the seller entered them;</li>
        <li>the pages viewed, the time spent and progress on each one, successive visits;</li>
        <li>
          your approximate location (country, region, city and approximate coordinates) derived from your IP address,
          your time zone and your language;
        </li>
        <li>
          your device, your browser and its full technical identifier (user-agent), as well as the page you came from.
          The IP address is never kept in the clear, only as a hash;
        </li>
        <li>what you write to the assistant on the page, and its answers;</li>
        <li>the voice comments you record, and their transcription;</li>
        <li>
          your replies: acceptance of the proposal (with the name entered, the hash of the IP and the browser, as
          proof), request for changes, meeting booking.
        </li>
      </ul>
      <p>
        From this information, Clozer calculates a level of interest and suggests to the seller the right time and
        the right message to get back in touch with you. To do so, an artificial intelligence analyzes your reading
        and your messages. No decision is imposed on you automatically: the seller decides whether to follow up.
      </p>
      <p>
        This information is used only by the seller. It is neither sold nor used for advertising. Every follow-up
        contains an unsubscribe link: one click is enough to stop receiving them from that seller.
      </p>

      <h2>You use Clozer</h2>
      <p>
        For your account, Clozer is the controller. We keep your email, your name, your documents and your settings
        in order to provide the service (performance of the contract), as well as login sessions (IP address and
        browser) for the security of your account. Your documents are stored privately and can only be accessed
        through the links you create.
      </p>
      <p>You can export your workspace data and delete your account or workspace from Settings › Data.</p>
      <p>
        To improve the product, we measure how it is used (pages opened, links created, proposals opened, plan
        changes) with PostHog, hosted in the European Union. These measurements are tied to a technical identifier of
        your account, never to your email, your name or your prospects&apos; information. This processing is based on
        our legitimate interest; you can object to it by writing to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. Technical errors are reported to Sentry, hosted in
        the European Union, without IP address.
      </p>
      <p>
        If you take a paid plan, payment goes through Stripe. You enter your card details with Stripe: Clozer never
        sees or stores them. We keep the billing name and address, the VAT number if any and the invoice history,
        which the law requires us to keep for 10 years.
      </p>

      <h2>Cold email campaigns</h2>
      <p>
        If you connect a mailbox and import prospects for a campaign, you are the controller of their data and Clozer
        processes it on your behalf, as a processor. We keep the imported addresses, the columns you add and the
        state of each send. The content of sent emails is deleted 90 days after sending. Every email carries an
        unsubscribe link: unsubscribed, bounced or stop-listed addresses stay in your stop list so they are never
        contacted again. Your mailbox is reached through the provider you choose, Google via Unipile, Microsoft, or
        your own IMAP server, listed on the <Link href="/subprocessors">subprocessors</Link> page.
      </p>
      <p>
        If you received an outreach email sent through Clozer, it left from the seller&apos;s mailbox, and the seller
        is the controller. The unsubscribe link at the bottom of the email stops every send; your address is then
        kept in their stop list, only so you are not written to again. If the email links to a document, its reading
        is tracked as described above.
      </p>

      <h2>The Chrome extension and the Outlook add-in</h2>
      <p>
        They only act within an email being drafted. They do not read the emails you receive and do not send the text
        of your messages to Clozer. When a PDF is replaced by a link (after your approval in Chrome, automatically in
        Outlook unless you turn on &ldquo;Ask me first&rdquo;), they send Clozer that PDF along with the address and
        name of the first recipient, to create the link in their name. In Outlook, when sending, the add-in detects
        the Clozer links in the email to mark them as sent.
      </p>
      <p>
        They check with Clozer regularly to let you know when a prospect reads one of your proposals. They keep a
        login token, which can be revoked at any time in Clozer&apos;s settings. Nothing is sold or used for
        advertising.
      </p>

      <h2>Artificial intelligence</h2>
      <p>
        Clozer uses Anthropic or OpenAI to read documents, answer questions asked on the reading page, draft
        follow-ups and analyze the progress of a deal. These services receive the text of the document, the messages,
        and a summary of the reading (pages, durations, device, country), without email address or IP address. Voice
        comments are transcribed by OpenAI. These providers do not use data sent through their API to train their
        models.
      </p>

      <h2>Cookies</h2>
      <ul>
        <li>
          <strong>Reading identifier</strong> (12 months): a random identifier that tells us two opens come from the
          same browser.
        </li>
        <li>
          <strong>Document access</strong> (30 days): remembers the email entered so it is not asked for again.
        </li>
        <li>
          <strong>Session</strong>: keeps Clozer users signed in.
        </li>
      </ul>
      <p>
        No advertising cookies, no advertising trackers. Audience measurement of the website and the app uses no
        cookie and no storage in your browser, and is never active on proposal reading pages.
      </p>

      <h2>Providers</h2>
      <p>
        Hosting and database in the European Union. The full list, with the location of each, is on the{" "}
        <Link href="/subprocessors">subprocessors</Link> page. Some are US companies: transfers are governed by the
        Data Privacy Framework or by the European Commission&apos;s standard contractual clauses.
      </p>
      <p>
        If the seller has connected their own tools (Slack, webhook, Calendly, Cal.com), some information is passed
        on to them under the seller&apos;s responsibility, for example your name and email to prefill a meeting
        booking.
      </p>

      <h2>Retention periods</h2>
      <ul>
        <li>
          Reading data, messages, voice comments and follow-ups: automatically deleted 12 months after the last
          activity on the link.
        </li>
        <li>Content of campaign emails sent from your mailbox: 90 days after sending.</li>
        <li>Proof of acceptance of a proposal: 5 years, the commercial limitation period.</li>
        <li>Documents deleted by the seller: permanently erased, files included, after 30 days.</li>
        <li>Seller account: kept while it is active, erased when deleted.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        You can access your data, have it corrected or deleted, object to its processing or request its restriction.
        If the request concerns a proposal you received, send it to the seller: they can export or erase your data
        directly. You can also write to us at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>; we forward it
        to the seller and reply within one month.
      </p>
      <p>You can also file a complaint with the CNIL (cnil.fr).</p>
    </>
  );
}
