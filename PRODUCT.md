# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Anyone who sends quotes ("devis") or proposals and then waits for an answer. Confirmed segments, each getting its own offer later:
- Independents: consultants, tradespeople (artisans), micro-agencies of 1 to 5 people.
- Solo B2B sellers and small agencies.
- SME sales teams with a manager who needs a team view.
- Large sales organisations (multinational teams), longer term.

Their job: send a proposal, know whether and how it is read, and follow up at the right moment instead of guessing or chasing blind. Secondary audience: the prospect who opens the link (public viewer), who must read comfortably and act (sign, ask for a change, book a meeting).

## Product Purpose
Clozer turns a proposal (PDF, web page or video) into one tracked link per prospect. It shows page-by-page reading, scores each prospect Hot / Warm / Cold, tells the seller who to follow up today, and drafts follow-ups (email or WhatsApp) that the seller approves by default. Success: more signed quotes, fewer ghosted proposals, and a seller who opens Clozer every morning because it tells them what to do.

## Positioning
"Sachez qui lit votre devis. Relancez au bon moment." The mechanism: one link per prospect, reading behaviour turned into a temperature and a concrete next action, with tracking that stays respectful of the prospect ("suivre sans fliquer", GDPR-first).

## Operating Context
- Seller app: "Aujourd'hui" (today's actions), documents, deal page per prospect (named after the prospect, never the document), team view for managers (2+ members), settings (essential vs advanced), prospecting behind a flag.
- Prospect viewer `/v/[slug]`: email gate, CTA bar (Valider & signer, Demander un ajustement, Prendre RDV via Calendly/Cal.com), AI chat, voice comments, video capsules.
- Smart Link for cold-email sequences (lemlist and similar): each clicking prospect gets their own tracking with no form.
- Chrome extension (Gmail/Outlook web: replaces PDF attachments with links, badge, notifications; not published yet) and Outlook add-in (paired by code).
- Alerts by email, extension or Slack; follow-ups on pricing-page reads, anti-ghosting reminders, optional autopilot.
- Signup: magic link and Google one-click (Google first). Onboarding gets a seller to a first live test link fast; getting-started emails follow up.
- Roles: workspace owner / admin / member; platform admin by email.

## Capabilities and Constraints
- Stack: Next.js app (`app/`), separate marketing site (`landing/`, www.clozer.club), WXT extension (`extension/`), Office.js add-in (`outlook/`). Tailwind v4, shadcn on Base UI.
- Seller-side UI is French only.
- Temperature (hot / warm / cold) is the product's core signal.
- Pricing: free during the beta. No billing yet. Segment offers exist in intent only; no prices or plan names are decided.

## Brand Commitments
- Name: Clozer. Voice: direct, plain French, short sentences, no corporate filler.
- The previous visual identity ("Encre & température") is being replaced; no visual element is binding.
- The result must not feel like a SaaS template, cold/corporate, gimmicky, or dense.

## Evidence on Hand
- Real product screens and flows; sample quote `app/public/onboarding/exemple-devis.pdf`.
- No customer logos, testimonials, case studies, usage numbers, or prices exist. Do not fabricate any. Demonstration data must be labelled as an example.

## Product Principles
1. One obvious next action on every screen.
2. Time to first value in minutes: from signup to a live tracked link without leaving the flow.
3. Heat is the signal: temperature carries meaning, everything else stays out of its way.
4. Track without spying: the prospect's experience is respectful and pleasant.
5. Every segment, same core: solo first-time users and team managers use one product, scaled by role.

## Accessibility & Inclusion
WCAG 2.1 AA target. Temperature never conveyed by colour alone. Light and dark themes in the app. Mobile usable (sellers check on the phone).
