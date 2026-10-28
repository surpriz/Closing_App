# Cold email landing page: design

Date: 2026-10-22. Status: draft, awaiting approval.

## Intent

Jérôme launches a cold email campaign in early November 2026 to win Clozer's first paying customers. Recipients are B2B sales leaders in France: Sales Manager, Head of Sales, Business Manager. The email links to a page built only for this channel, separate from the home page of www.clozer.club.

The message: once a proposal, PDF or link is sent, the seller goes blind. What happens next (who opens it, what they reread, who they forward it to) is a gold mine almost nobody knows they can get. Seeing it means following up at the right moment, spotting when the deal reaches the real decision maker, dropping dead deals, and for a manager, a pipeline based on facts instead of what reps say. The end result they care about: more meetings, faster closes, more signed deals.

The page has one job: get the visitor to create an account and try Clozer alone, right away. No demo booking, no contact form.

## Goals

- Visitors from the campaign create an account on this page (email magic link or Google).
- Those accounts get a campaign-only offer: 30-day Team trial, no card, and 30% off the first 12 months if they subscribe before their trial ends.
- Every signup from the campaign is attributed (source and campaign stored on the workspace), so the funnel visit → account → first link sent → paid is measurable in PostHog.

## Non-goals

- English version (later; the i18n setup makes it a follow-up).
- Writing the cold emails themselves (separate piece of work if wanted).
- Changes to the main home page, pricing page or nav.
- A/B testing infrastructure.

## Anti-goals (failure even if it works)

- Fake proof: no invented logos, testimonials, usage numbers or customer counts. Demo data is labelled "exemple" (PRODUCT.md rule).
- Fake urgency: no countdown that resets, no "plus que 3 places". The deadline is real and enforced.
- Saying or implying these are Clozer's first customers. The framing is "offre réservée aux personnes contactées par email".
- SaaS jargon ("tracking", "analytics", "insights"). Talk deals, follow-ups, meetings, proposals.
- A page that looks like a generic SaaS template (DESIGN.md rejects the split hero + feature-card grid).

## Audience and tone

Sales leaders who send proposals all day and live by their pipeline. Direct, peer-to-peer, short sentences, "vous". French only.

## The offer (decided)

- Signup through this page between campaign start and **30 November 2026, 23:59 Europe/Paris** → workspace gets a **30-day Team trial** (instead of the standard 14), no card.
- If that workspace subscribes to a paid plan (Solo or Team) **before its trial ends** → **30% off for 12 months**, applied automatically at Stripe checkout. (My call: "before the trial ends" is the condition, as stated to Jérôme during the brainstorm; signup deadline and discount window are therefore distinct.)
- Applies to monthly and yearly plans alike (decided by Jérôme): copy can simply say "-30 % la première année".
- Eligibility is an open code (decided by Jérôme): anyone reaching the app through this page gets it, including colleagues the email was forwarded to. No per-recipient token.
- Paying early must not cost free days (my call): a discounted checkout sets `subscription_data.trial_end` to the workspace's `trialEndsAt`, so billing starts when the trial would have ended and the 12 months run from there. The webhook and plan resolution must treat Stripe `trialing` as paid.
- The offer must be visible inside the app before the trial ends (my call, otherwise the discount converts nobody): billing settings page, the existing trial banner, and the `billing_trial_ending` email mention the 30% and the date it expires for that workspace.
- After the deadline: the page swaps the offer block for the standard offer (14-day Team trial, no card) and the app ignores the offer code. The server is the authority on the deadline, not the page. The deadline is checked against the time the offer cookie was set on `/login` (my call), so a magic link clicked just after midnight still honours a request made before it; the cookie lives 24 hours.

## Page (decided: structure "A · Le choc puis la preuve")

Lives on the landing site (`landing/`, Next.js 16, next-intl, Tailwind v4), French only, uses the existing design system (DESIGN.md: report paper, ink rules, Archivo condensed headlines, ironbow only for heat data).

- No site nav and no footer links into the rest of the site: logo only (not linked, or linked to the same page), plus the legally required links (mentions légales, confidentialité) in a minimal footer. My call.
- `noindex`, excluded from the sitemap. My call.
- Path: `/fr/propale` (my call; the route needs a pathnames entry; no `en` page, so the `en` locale should 404 or redirect to `/fr/propale`).

Sections, top to bottom:

1. **Hero** (fits the first mobile screen): the lived scene as headline, draft: "Votre propale est partie mardi. Depuis, elle a été lue 4 fois. Vous ne le savez pas." One line of explanation. Offer block with the deadline. Signup form right below (existing `SignupForm`: email + Google).
2. **Exemple de lecture**: a proposal heating up page by page, reusing the site's thermal reading components, clearly labelled "exemple". Ends on the verdict (e.g. "Chaud, à relancer ce matin").
3. **Ce que vous gagnez**: follow up when they reread, see when it reaches the CFO/CEO (forward detection), stop chasing dead deals, more meetings and signed deals.
4. **Pour le manager**: Team view, each rep's real pipeline, coaching on facts.
5. **Questions**: does the prospect see it / GDPR, Gmail and Outlook, what happens after 30 days, price after the offer.
6. **Final block**: offer reminder + signup form.

All copy is drafts until written with the `copywriting` then `copy-editing` skills; `landing-page-conversion-audit` runs on the finished page before launch.

## Signup, offer and attribution flow

Today: landing form → `GET https://app.clozer.club/login?email=…&lang=fr` (or `?provider=google`) → magic link or Google OAuth → first sign-in calls `resolveWorkspace` (`app/src/lib/session.ts`), which creates the organization with `trialEndsAt: trialEndsAtFor(now)` (14 days, `app/src/lib/billing/plans.ts`).

Needed:

- **Landing**: the page's two signup paths (email form and Google link) forward an offer code (e.g. `offer=cold-2026-11`) and the incoming `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` from the page URL to `/login`.
- **App, login**: accept those params and keep them across the magic link round trip and the Google OAuth redirect until the workspace is created (e.g. a short-lived, httpOnly first-party cookie set on `/login`). Values are validated against a known offer list; unknown codes are ignored.
- **App, workspace creation**: if a valid, unexpired offer is present when `resolveWorkspace` creates a new organization, set `trialEndsAt` to 30 days and record the offer code. Always record acquisition (utm values) when present. Existing workspaces are never changed by an offer link (an existing user signing in through the page gets nothing new). Needs new columns on `Organization` (offer code, acquisition source/campaign), via a Prisma migration.
- **App, billing**: in `billing-actions.ts` checkout, if the organization carries the offer and `now < trialEndsAt`, attach the Stripe coupon (30% off, `duration: repeating`, 12 months, monthly and yearly prices) via `discounts`, and set `trial_end` as described in the offer section. Note Stripe refuses `discounts` together with `allow_promotion_codes`, so drop the latter only on discounted sessions.
- **Stripe**: create the coupon in test and live; its id goes in env config.
- **Analytics** (my call): the landing stays cookieless, so visit → signup is compared as aggregate counts per campaign (landing pageviews with utm values vs app signups with that campaign), not a per-person funnel. From signup on, it is per person: the app adds the offer and campaign as properties on its server-side `signed_up` event (`app/src/lib/auth.ts`) and on later events, so signup → first link sent → paid is a real PostHog funnel.

## Constraints

- Real deadline enforced server side (30 Nov 2026 23:59 Europe/Paris).
- Must be live and checked in production before the first emails go out (early November 2026).
- GDPR: the page stays cookieless on the landing side, as today; the app cookie carrying the offer is functional and short-lived.
- Repo conventions: push to `surpriz` remote, landing and app deploy separately.
- Deploy path (decided by Jérôme): ship only this work to production. Staging holds other unreleased work (data-security baseline, 84db42c and before) that must not go to prod with it. Build on a branch cut from `main`, merge it to `main` for prod, and merge it into `staging` too so the branches don't diverge. The Prisma migration must apply cleanly on prod's schema.

## Left to the builder

- Exact component breakdown and reuse of existing landing components (thermal reading, signup form, logo).
- Cookie name, lifetime and the exact Prisma fields.
- Final copy (through the copywriting skills, then shown to Jérôme).
- How the expired state of the page is rendered.
