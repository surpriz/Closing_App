# Cold Email Landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A French landing page for the November 2026 cold email campaign whose signups get a 30-day Team trial and 30% off 12 months, with every signup attributed to its campaign.

**Architecture:** The landing page (`landing/`, `/fr/propale`) forwards an offer code and the `utm_*` values to `app.clozer.club/login`. The app's proxy stores them in a short-lived first-party cookie, workspace creation reads it (30-day trial, offer and source columns), checkout applies a fixed Stripe coupon and defers billing to the trial end, and the billing UI and email mention the offer.

**Tech Stack:** Next.js 16 (both apps), next-intl, Tailwind v4, Prisma 7 on Neon, Better Auth, Stripe, PostHog, Vitest (app only).

**Spec:** `docs/superpowers/specs/2026-10-22-cold-email-landing-design.md`

## Global Constraints

- Branch `feature/cold-email-landing`, cut from `surpriz/main` (9bb5ddf). Never base on staging. Push to remote `surpriz`, never `origin`.
- Offer code: `cold-2026-11`. Signup deadline: 30 November 2026 23:59 Europe/Paris = `2026-11-30T22:59:59Z`.
- Offer: 30-day Team trial, no card; 30% off for 12 months on Solo or Team, monthly and yearly, if checkout happens before the workspace's `trialEndsAt`.
- Stripe coupon id: `cold-2026-11-30off` (percent_off 30, duration repeating, duration_in_months 13: Stripe counts the months from subscription creation, trial included, so 13 covers 12 billed months after a ~30-day trial), same id in test and live.
- Cookie `clozer_signup_source`: httpOnly, sameSite lax, secure on https, path `/`, max age 24 h.
- Copy rules: French, "vous", no "premiers clients", no invented proof, no fake urgency, no "tracking/analytics" jargon. Demo data labelled "exemple".
- Landing stays cookieless; the page is `noindex` and absent from the sitemap.
- App commits follow Conventional Commits; no AI mention anywhere.

## Review Focus

1. Magic link opened on another device than the one that filled the form: the offer must still apply (callbackURL carries the source). Test in Task 2.
2. Existing user signing in through the page: no workspace change, no trial extension. Test in Task 3.
3. Request made at 23:58 on 30 Nov, link clicked at 00:05: offer honoured; request at 00:01: standard trial. Test in Task 1.
4. Checkout when the trial ends in under 48 hours: Stripe rejects `trial_end` that close, so the coupon applies without `trial_end`. Test in Task 4.
5. Forged or unknown `offer` value, or `utm_*` longer than 100 chars: ignored or truncated, never stored raw. Test in Task 1.

---

### Task 1: Signup source and offer rules (app, pure)

**Files:**
- Create: `app/src/lib/billing/offers.ts`
- Create: `app/src/lib/acquisition.ts`
- Test: `app/src/lib/billing/offers.test.ts`, `app/src/lib/acquisition.test.ts`
- Modify: `app/src/lib/billing/plans.ts:186` (`trialEndsAtFor` gains optional days)

**Interfaces:**
- Produces:
  - `type Offer = { code: string; trialDays: number; signupDeadline: Date; couponId: string; discountPercent: number; discountMonths: number }`
  - `OFFERS: Record<string, Offer>` with the single entry `cold-2026-11` (values from Global Constraints)
  - `offerFor(code: string | null | undefined): Offer | null`
  - `type SignupSource = { offer: string | null; requestedAt: number; utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; utmContent: string | null }`
  - `SIGNUP_SOURCE_COOKIE = "clozer_signup_source"`, `SIGNUP_SOURCE_MAX_AGE = 86400`
  - `SOURCE_PARAMS = ["offer", "utm_source", "utm_medium", "utm_campaign", "utm_content"] as const`
  - `sourceFromParams(params: URLSearchParams, now: Date): SignupSource | null` (null when none of SOURCE_PARAMS present)
  - `serializeSource(source: SignupSource): string` / `parseSource(value: string | undefined): SignupSource | null`
  - `appendSource(path: string, source: SignupSource): string` (adds SOURCE_PARAMS present in source to a relative path's query)
  - `signupOffer(source: SignupSource | null, now: Date): Offer | null` (valid code, `requestedAt <= signupDeadline`, `now - requestedAt <= 24 h`)
  - `trialEndsAtFor(createdAt: Date, days = TRIAL_DAYS): Date`

- [ ] **Step 1: Write the failing tests**

```ts
// offers.test.ts
const offer = offerFor("cold-2026-11")!;
expect(offer.trialDays).toBe(30);
expect(offer.signupDeadline.toISOString()).toBe("2026-11-30T22:59:59.000Z");
expect(offer.couponId).toBe("cold-2026-11-30off");
expect(offerFor("COLD-2026-11")).toBeNull();
expect(offerFor("nope")).toBeNull();

// acquisition.test.ts
const at = (iso: string) => new Date(iso);
const src = (requested: string, offer = "cold-2026-11") =>
  sourceFromParams(new URLSearchParams({ offer }), at(requested))!;
// Review Focus 3
expect(signupOffer(src("2026-11-30T22:58:00Z"), at("2026-11-30T23:05:00Z"))?.code).toBe("cold-2026-11");
expect(signupOffer(src("2026-11-30T23:01:00Z"), at("2026-11-30T23:02:00Z"))).toBeNull();
expect(signupOffer(src("2026-11-10T10:00:00Z"), at("2026-11-11T10:00:01Z"))).toBeNull(); // over 24 h
// Review Focus 5
expect(signupOffer(src("2026-11-10T10:00:00Z", "forged"), at("2026-11-10T10:01:00Z"))).toBeNull();
const long = sourceFromParams(new URLSearchParams({ utm_campaign: "x".repeat(300) }), at("2026-11-10T10:00:00Z"))!;
expect(long.utmCampaign).toHaveLength(100);
expect(parseSource(serializeSource(long))).toEqual(long);
expect(parseSource("garbage")).toBeNull();
expect(sourceFromParams(new URLSearchParams({ email: "a@b.fr" }), at("2026-11-10T10:00:00Z"))).toBeNull();
expect(appendSource("/dashboard", src("2026-11-10T10:00:00Z"))).toBe("/dashboard?offer=cold-2026-11");
expect(trialEndsAtFor(at("2026-11-10T00:00:00Z"), 30).toISOString()).toBe("2026-12-10T00:00:00.000Z");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run src/lib/acquisition.test.ts src/lib/billing/offers.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement** `offers.ts`, `acquisition.ts` and the `trialEndsAtFor` parameter. Serialize as a URLSearchParams string (`offer`, `t`, `utm_*`); parse rejects a missing or non-numeric `t`. Values trimmed and cut to 100 chars; `offer` is kept as given (validated later by `signupOffer`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run src/lib/acquisition.test.ts src/lib/billing/offers.test.ts src/lib/billing/plans.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit** `feat(billing): add campaign offer and signup source rules`

### Task 2: Carry the source through login (app proxy + login page)

**Files:**
- Modify: `app/src/proxy.ts` (redirect branch and `config.matcher`)
- Modify: `app/src/app/(auth)/login/page.tsx:24-70`

**Interfaces:**
- Consumes: `sourceFromParams`, `serializeSource`, `parseSource`, `appendSource`, `SIGNUP_SOURCE_COOKIE`, `SIGNUP_SOURCE_MAX_AGE`, `SOURCE_PARAMS` (Task 1).

- [ ] **Step 1: Proxy.** Extend the existing `?lang=` branch into one: when a non-`/api/` request carries `lang` or any of `SOURCE_PARAMS`, redirect to the same URL with all of them removed, setting the locale cookie (as today) and, when `sourceFromParams` returns a source, the `clozer_signup_source` cookie (attributes from Global Constraints; overwrite any previous one). Add a matcher entry per source param, shaped like the existing `lang` one.

- [ ] **Step 2: Login page.** Read the cookie with `cookies()`; when it parses, pass `appendSource(next, source)` instead of `next` to `LoginForm`, so the magic link's callbackURL brings the source back on another device (Review Focus 1).

- [ ] **Step 3: Verify by hand** (no proxy test harness exists): `cd app && npm run dev`, open `http://localhost:3000/login?lang=fr&offer=cold-2026-11&utm_source=lemlist&utm_campaign=nov`.
Expected: one redirect to `/login`, URL clean, DevTools shows `NEXT_LOCALE=fr` and `clozer_signup_source` (httpOnly, 24 h). With dev magic links on, the logged link's callbackURL contains `offer=cold-2026-11&utm_source=lemlist&utm_campaign=nov`.

- [ ] **Step 4: Run** `cd app && npm run typecheck && npm run lint` → no errors.

- [ ] **Step 5: Commit** `feat(auth): keep campaign source across the sign-in round trip`

### Task 3: Store the offer and source on new workspaces (app, schema + session + analytics)

**Files:**
- Modify: `app/prisma/schema.prisma` (model `Organization`)
- Create: `app/prisma/migrations/20261106000000_signup_source/migration.sql` (named after staging's `20261105000000_audit_logs` so merging into staging keeps order)
- Modify: `app/src/lib/session.ts:69-90` (`resolveWorkspace` create branch)
- Modify: `app/src/lib/auth.ts:121` (`signed_up` hook)
- Test: `app/src/lib/acquisition.test.ts` (add `workspaceSourceData` cases)

**Interfaces:**
- Consumes: Task 1.
- Produces:
  - `Organization` columns, all nullable `String?`: `offerCode`, `acquisitionSource`, `acquisitionMedium`, `acquisitionCampaign`, `acquisitionContent`.
  - `workspaceSourceData(source: SignupSource | null, now: Date): { trialEndsAt: Date; offerCode: string | null; acquisitionSource: string | null; acquisitionMedium: string | null; acquisitionCampaign: string | null; acquisitionContent: string | null }` in `acquisition.ts`.

- [ ] **Step 1: Write the failing test**

```ts
const now = new Date("2026-11-10T10:00:00Z");
const cold = sourceFromParams(new URLSearchParams({ offer: "cold-2026-11", utm_source: "lemlist" }), now);
expect(workspaceSourceData(cold, now)).toMatchObject({ offerCode: "cold-2026-11", acquisitionSource: "lemlist", trialEndsAt: new Date("2026-12-10T10:00:00Z") });
expect(workspaceSourceData(null, now)).toMatchObject({ offerCode: null, trialEndsAt: new Date("2026-11-24T10:00:00Z") });
const late = sourceFromParams(new URLSearchParams({ offer: "cold-2026-11", utm_source: "lemlist" }), new Date("2026-12-01T10:00:00Z"));
expect(workspaceSourceData(late, new Date("2026-12-01T10:00:00Z"))).toMatchObject({ offerCode: null, acquisitionSource: "lemlist" });
```

- [ ] **Step 2: Run to verify it fails** → `cd app && npx vitest run src/lib/acquisition.test.ts`, FAIL on `workspaceSourceData`.

- [ ] **Step 3: Implement** `workspaceSourceData`; add the five columns and the migration (`ALTER TABLE "organization" ADD COLUMN ...`, check the real table name in `20261103000000_billing`); in `resolveWorkspace`, replace `trialEndsAt: trialEndsAtFor(now)` with the spread of `workspaceSourceData(parseSource(cookie), now)`. Only the create branch changes, so existing workspaces never move (Review Focus 2). In the `signed_up` hook, read the cookie from `ctx?.headers ?? ctx?.request?.headers` (same way as `requestLocale`) and send `offer`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` as properties plus a `$set` of `acquisition_campaign` and `offer` so later events filter by person.

- [ ] **Step 4: Verify.** `cd app && npx prisma migrate dev` applies cleanly; `npx vitest run` all green; by hand, sign up a fresh email through `/login?offer=cold-2026-11&utm_source=lemlist` → in `npx prisma studio`, the new organization has `offerCode = cold-2026-11`, `trialEndsAt` 30 days out. Sign in again with an existing account through the same URL → its organization unchanged.

- [ ] **Step 5: Commit** `feat(billing): give campaign signups their offer and record their source`

### Task 4: Discounted checkout (app billing + Stripe coupon)

**Files:**
- Modify: `app/src/lib/billing/offers.ts`
- Modify: `app/src/app/(dashboard)/settings/billing-actions.ts:54-69`
- Test: `app/src/lib/billing/offers.test.ts`

**Interfaces:**
- Consumes: `offerFor` (Task 1), `Organization.offerCode` (Task 3).
- Produces: `checkoutOffer(org: { offerCode: string | null; trialEndsAt: Date | null }, now: Date): { couponId: string; trialEnd: number | null } | null` — null without a valid offer or when `now >= trialEndsAt`; `trialEnd` is `trialEndsAt` in Unix seconds, or null when under 48 h away.
- Produces: `offerEndsAt(org: { offerCode: string | null; trialEndsAt: Date | null }, now: Date): Date | null` — the date the discount can no longer be taken, for Task 5.

- [ ] **Step 1: Write the failing tests**

```ts
const now = new Date("2026-11-10T10:00:00Z");
const org = { offerCode: "cold-2026-11", trialEndsAt: new Date("2026-12-10T10:00:00Z") };
expect(checkoutOffer(org, now)).toEqual({ couponId: "cold-2026-11-30off", trialEnd: Date.parse("2026-12-10T10:00:00Z") / 1000 });
// Review Focus 4
expect(checkoutOffer(org, new Date("2026-12-09T11:00:00Z"))).toEqual({ couponId: "cold-2026-11-30off", trialEnd: null });
expect(checkoutOffer(org, new Date("2026-12-10T10:00:00Z"))).toBeNull();
expect(checkoutOffer({ offerCode: null, trialEndsAt: org.trialEndsAt }, now)).toBeNull();
expect(offerEndsAt(org, now)).toEqual(org.trialEndsAt);
expect(offerEndsAt(org, new Date("2026-12-11T00:00:00Z"))).toBeNull();
```

- [ ] **Step 2: Run to verify it fails** → `cd app && npx vitest run src/lib/billing/offers.test.ts`, FAIL.

- [ ] **Step 3: Implement** both functions. In `startCheckout`, load `offerCode` and `trialEndsAt` with the organization; when `checkoutOffer` returns a value, send `discounts: [{ coupon }]` instead of `allow_promotion_codes: true` (Stripe refuses both), and add `trial_end` to `subscription_data` when not null. No webhook change: `trialing` is already in `PAID_STATUSES`.

- [ ] **Step 4: Create the test-mode coupon and verify.** `stripe coupons create --id cold-2026-11-30off --percent-off 30 --duration repeating --duration-in-months 13 --name "Offre email -30 %"` (test mode). With the workspace from Task 3, start a Team yearly checkout: Stripe shows -30 % and "trial until 10 Dec"; pay with `4242 4242 4242 4242`; the webhook sets `planStatus = trialing`; the app still shows Team.

- [ ] **Step 5: Commit** `feat(billing): apply the campaign discount at checkout`

### Task 5: Show the offer in the app (billing page, banner, trial-ending email)

**Files:**
- Modify: `app/src/components/dashboard/billing-settings.tsx` (new prop `offerEndsAt: string | null`)
- Modify: `app/src/app/(dashboard)/settings/page.tsx:162` (pass it, from `offerEndsAt`)
- Modify: `app/src/components/billing/trial-banner.tsx` (new prop `offer: boolean`; its callers pass it)
- Modify: `app/src/lib/billing/emails.ts` (`BillingEmailData.offer?: boolean`; extra block in `billing_trial_ending`)
- Modify: `app/src/lib/billing/send-emails.ts` (select `offerCode`, pass `offer`)
- Modify: `app/messages/fr/*.json`, `app/messages/en/*.json` (keys below, in the files that hold `billing.*` and `emails.billing.*`)
- Test: `app/src/lib/billing/emails.test.ts`

**Interfaces:**
- Consumes: `offerEndsAt` (Task 4).

Copy (FR; EN is a plain translation):
- `billing.offer.line`: "Votre offre : -30 % pendant 12 mois si vous choisissez une formule avant le {date}. Vos jours d'essai restants sont conservés."
- `billing.banner.offer`: "Plus que {days} jours pour garder -30 % pendant 12 mois."
- `emails.billing.trialEnding.offer`: "Votre remise de 30 % pendant 12 mois reste valable jusqu'à la fin de l'essai. Si vous choisissez une formule maintenant, vous ne payez qu'à partir de cette date."

- [ ] **Step 1: Write the failing test**

```ts
const email = buildBillingEmail("billing_trial_ending", { ...DATA, offer: true });
expect(email.html).toContain("30 %");
expect(buildBillingEmail("billing_trial_ending", { ...DATA, offer: false }).html).not.toContain("30 %");
```

- [ ] **Step 2: Run to verify it fails** → `cd app && npx vitest run src/lib/billing/emails.test.ts`, FAIL.

- [ ] **Step 3: Implement.** Billing settings shows `billing.offer.line` above the plans when `offerEndsAt` is set. The banner uses `billing.banner.offer` instead of the trial message when `offer` is true and `banner.kind` is the trial kind. The email adds the offer block after the body when `offer` is true.

- [ ] **Step 4: Verify.** `cd app && npx vitest run && npm run typecheck` green; by hand, with the Task 3 workspace's `trialEndsAt` set 2 days out (admin trial field), settings shows the line and the banner the offer text.

- [ ] **Step 5: Commit** `feat(billing): remind campaign workspaces of their discount`

### Task 6: Page copy (landing)

**Files:**
- Create: `landing/src/content/propale.ts` (French copy only, no `en`, so `messages/*.json` stay in sync without fake English keys)

**Interfaces:**
- Produces: `PROPALE` (object of strings, one key per section in Task 7: `meta`, `hero`, `offer`, `offerExpired`, `example`, `gains`, `manager`, `faq`, `final`) and `COLD_OFFER = { code: "cold-2026-11", deadline: new Date("2026-11-30T22:59:59Z") }` with a comment that it mirrors `app/src/lib/billing/offers.ts`.

- [ ] **Step 1: Write the copy** with the `copywriting` skill, then pass it through `copy-editing`. Input: the spec's Intent, Audience and Offer sections, the Global Constraints copy rules, and the existing home copy in `landing/messages/fr.json` (`home`) for voice. Hero starts from "Votre propale est partie mardi. Depuis, elle a été lue 4 fois. Vous ne le savez pas." FAQ answers: does the prospect see it (GDPR, "suivre sans fliquer"), Gmail and Outlook, what happens after 30 days (Gratuit or paid, no automatic charge), price after the year (19 € Solo, 39 € Équipe per member, HT).
- [ ] **Step 2: Gate.** Show the copy to Jérôme and apply his edits before Task 7 renders it.
- [ ] **Step 3: Commit** `feat(landing): add cold email page copy`

### Task 7: The page (landing)

**Files:**
- Create: `landing/src/app/[locale]/cold-email/page.tsx`
- Modify: `landing/src/i18n/routing.ts` (pathname `"/cold-email": { en: "/cold-email", fr: "/propale" }`)
- Modify: `landing/src/components/signup-form.tsx` (optional prop `extraParams?: Record<string, string>`: hidden inputs, and appended to the Google href through `appUrl`)

**Interfaces:**
- Consumes: `PROPALE`, `COLD_OFFER` (Task 6); `SignupForm`, `ThermalReading`, `READING_PAGES`, `HeatScale`, `Logo`, `appUrl`.

- [ ] **Step 1: Build the page.** `notFound()` when locale is not `fr`. Reads `searchParams` (dynamic rendering): copies `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` into `extraParams`, plus `offer: COLD_OFFER.code` while `new Date() <= COLD_OFFER.deadline`; past it, renders `offerExpired` and no offer param. Metadata: `robots: { index: false, follow: false }`, title and description from `PROPALE.meta`. Not added to `sitemap.ts`. Layout: logo only on top, no `SiteHeader`; sections in the spec's order; signup form in the hero (within the first mobile screen) and in the final block; a minimal footer with links to `/legal` and `/privacy`. Follow `DESIGN.md` (ironbow only on heat data, ink rules between sections, Archivo condensed headline) and the home page's markup patterns.
- [ ] **Step 2: Verify.** `cd landing && npm run typecheck && npm run lint && npm run build` green. `npm run dev`, open `http://localhost:3001/fr/propale?utm_source=lemlist&utm_campaign=nov` at 375 px and 1280 px: form visible without scrolling on mobile; submitting goes to `app.clozer.club/login?email=…&lang=fr&offer=cold-2026-11&utm_source=lemlist&utm_campaign=nov`; the Google link carries the same params; `/en/cold-email` is a 404; page source has `noindex`; `/sitemap.xml` doesn't list it.
- [ ] **Step 3: Commit** `feat(landing): add cold email landing page`

### Task 8: Conversion audit and fixes

- [ ] **Step 1:** Run the `landing-page-conversion-audit` skill on the page (local build or preview URL).
- [ ] **Step 2:** List the findings for Jérôme ranked by impact; apply the ones he accepts (copy changes go through `copy-editing`). Do not remove or move a visible element without asking.
- [ ] **Step 3: Commit** `fix(landing): apply conversion audit to cold email page`

### Task 9: Ship to production

Every step here is outward-facing: confirm with Jérôme before each push and before live Stripe changes.

- [ ] **Step 1:** Jérôme creates the live coupon with the same command as Task 4 Step 4, in live mode (or from the Stripe dashboard with id `cold-2026-11-30off`).
- [ ] **Step 2:** Merge `feature/cold-email-landing` into `main`, push `surpriz main`. Check that `app/scripts/vercel-build.mjs` runs `prisma migrate deploy`; confirm the migration applied on prod.
- [ ] **Step 3: Prod check.** Open `https://www.clozer.club/fr/propale?utm_source=test&utm_campaign=check`, sign up with a fresh address, confirm the workspace has the offer and source (admin page or DB), the billing page shows the offer line, and PostHog shows `signed_up` with `offer` and `utm_campaign`. Then delete that test account.
- [ ] **Step 4:** Merge `main` into `staging`, push `surpriz staging`. Expected: no migration conflict (`20261106…` sorts after staging's `20261105…`).
- [ ] **Step 5:** Update `PRODUCT.md` pricing lines (beta/no billing is outdated) and the project memory with the prod commit.
