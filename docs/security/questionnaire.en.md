# Security questionnaire: standard answers (EN)

Translation of [questionnaire.fr.md](questionnaire.fr.md), for customers who send their questionnaire in English.
Same rule: true as of 22 Oct 2026, reread when the code changes. Items marked **[to confirm]** depend on an action
not done yet (see the checklist at the bottom of the French file).

## Company and organisation

**Who publishes Clozer?**
JAAP v2 (SASU), France. Security contact: contact@clozer.club.

**Do you hold ISO 27001 or SOC 2?**
Not of our own. Our hosting providers do: Vercel and Neon are ISO 27001 certified and SOC 2 Type 2 audited, as is
AWS. Payments go through Stripe (PCI DSS Level 1).

**Do you have a written security policy?**
Yes: public page www.clozer.club/en/security, an incident response procedure, an access register and an internal
backup procedure. Available on request.

**Who can access production data?**
The founder only. Console accounts (Vercel, Neon, AWS, Stripe) are personal, with two-factor authentication
**[to confirm]**. No contractor has access to data.

## Hosting and location

**Where is the data hosted?**
European Union: application at Vercel (Paris), database at Neon (Frankfurt), files at Vercel Blob (Paris), emails
at AWS SES (Stockholm).

**Does any data leave the EU?**
Yes, document text is sent to the AI providers (Anthropic or OpenAI, United States) for automatic reading and
drafting follow-ups, without the readers' email or IP address. Voice comments are transcribed by OpenAI. Covered by
their DPAs and the Data Privacy Framework or standard contractual clauses. WhatsApp follow-ups (Twilio, US) are only
sent if the seller turns them on.

**Do your AI providers train on our data?**
No. API use, with no training on customer data, under Anthropic's and OpenAI's terms. PDF translation goes through
DeepL API Pro (Germany), which deletes documents once translated.

**Subprocessor list?**
www.clozer.club/en/subprocessors. Customers are notified 30 days before any addition.

## Encryption

**Encryption in transit?**
HTTPS (TLS 1.2+) everywhere, 2-year HSTS including subdomains.

**Encryption at rest?**
AES-256 by Neon (database) and Vercel Blob (files). Customer secrets (Slack webhooks, signing keys) and Google OAuth
tokens are also encrypted by the application with AES-256-GCM. Extension and Outlook add-in tokens are stored
hashed (SHA-256).

**Key management?**
Application keys live in Vercel's encrypted environment variables, never in code (gitleaks scan on every commit).
Encryption-at-rest keys are managed by the hosting providers.

## Documents and links

**How are documents protected?**
Private storage with no public URL. Every opening goes through our servers, which check the link is active, not
expired, not withdrawn, and that the email was given if required. Served with `Cache-Control: private, no-store`
and `X-Robots-Tag: noindex`.

**Can a link be guessed?**
No. Random 12-character identifier (62-character alphabet, about 71 bits) from `crypto.randomInt`. Requests are
rate-limited per IP.

**Can a link be revoked?**
Yes, immediately (withdrawal or expiry), including forwarded copies and links derived from a Smart Link.

**Is the reader authenticated?**
They are identified by the email they type (per-link option), not verified. The cookie remembering that email is
signed (HMAC) and scoped to each link. No code verification, password or watermark today.

**Can downloading be prevented?**
Not today.

**How are uploads checked?**
PDF only (type and header bytes checked on the server), 25 MB maximum, storage path scoped to the workspace,
random file name.

## Access and authentication

**How do users sign in?**
Passwordless: an email sign-in link (valid 5 minutes, single use) or Google. 7-day sessions, `HttpOnly`, `Secure`,
`SameSite=Lax` cookies. Attempts are limited (5 links per minute per IP).

**Two-factor authentication?**
Not Clozer's own. With Google sign-in, the Google account's 2FA applies.

**SSO / SAML?**
Not today.

**Permissions?**
Owner / admin / member roles. Exports, erasures and document deletion are for admins; workspace deletion for the
owner.

**Tenant isolation?**
Shared database, logical isolation: every query is filtered by workspace on the server, files stored per workspace.
No query takes an identifier without checking the workspace (reviewed in October 2026).

**Logging?**
Per-workspace audit log of sensitive actions (team, exports, erasures, deletions, extension sign-in), kept 12
months. Platform admin actions logged separately. Application logs at Vercel.

## Development and operations

**Development practices?**
Every change goes through a staging environment before production. Automated tests, strict typing, CI on every push
(tests, lint, build). CodeQL code analysis, gitleaks secret scanning, dependency audit (`npm audit`) and Dependabot.

**Application protections?**
Security headers (HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, CSP), rate limits on public
entry points, parameterised SQL, input validation (zod), SSRF guard on customer-supplied URLs (DNS resolution, no
redirects), outbound webhooks signed with HMAC SHA-256, inbound webhooks verified (Stripe, AWS SNS).

**Penetration tests?**
No external pentest to date. Internal security review done in October 2026. Responsible disclosure:
contact@clozer.club, answer within 72 hours.

**Backups?**
Continuous backup by Neon with point-in-time restore. Restore procedure tested on **[to confirm]**.

**Business continuity?**
Fully managed infrastructure (Vercel, Neon, AWS). The application can be redeployed from the Git repository in
minutes.

## Incidents and GDPR

**Breach notification?**
To the customer within 48 hours at most after becoming aware, with what they need for their own notification to the
authority (72 hours). Written procedure.

**GDPR role?**
Clozer is processor for prospect data, the customer is controller. Public DPA (Article 28):
www.clozer.club/en/dpa, signed copy on request.

**Retention?**
Reading data: 12 months after the link's last activity, erased automatically. Deleted documents: erased for good
after 30 days, files included. Signature proofs: 5 years. Billing: 10 years. IP addresses: never in clear (salted
SHA-256 hash).

**Data subject rights?**
Prospect export and erasure from Settings › Data. JSON export and full workspace deletion at any time. Readers are
informed on the page, every follow-up carries an unsubscribe link.

**End of contract?**
Deleting the workspace deletes its data and files and stops the Stripe subscription.
