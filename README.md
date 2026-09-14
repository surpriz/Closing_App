# Closing app

Turn PDF proposals into tracked links, see how prospects read them, and send
follow-ups based on that behavior (email / WhatsApp).

Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui, Prisma 7 on
Neon, Better Auth, Vercel Blob, Trigger.dev, Vercel AI SDK (OpenAI or
Anthropic), Resend, Twilio, Stripe.

## Setup

```bash
cp .env.example .env.local   # fill in values
npm install                  # also runs prisma generate
npm run db:deploy            # apply migrations to Neon
npm run dev
```

## Layout

```
prisma/
  schema.prisma                 all models (tables mapped to snake_case)
  migrations/                   SQL migrations
src/
  app/
    (auth)/login/               magic link + Google sign-in
    (dashboard)/documents/      upload, document list
    (dashboard)/documents/[id]/ analytics, links, follow-ups
    (dashboard)/settings/       workspace follow-up defaults, alerts
    v/[slug]/                   public proposal viewer
    api/auth/[...all]/          Better Auth handler
    api/upload/                 Vercel Blob client upload token
    api/track/                  page view tracking (sendBeacon)
    api/v/[slug]/chat/          prospect Q&A on the proposal
    api/v/[slug]/actions/       validate & sign / request changes
    api/webhooks/{twilio,resend,stripe}/
  components/
    ui/                         shadcn
    dashboard/                  page time chart, score badge, follow-ups table
    viewer/                     pdf.js renderer, CTA bar, chat widget
  lib/
    db.ts  auth.ts  auth-client.ts  env.ts
    closing/
      constants.ts  types.ts
      engagement/               page view upsert, Hot/Warm/Cold scoring
      triggers/                 hot pricing, anti-ghosting, hot lead
      ai/                       provider switch, prompts, page tagging, chat
      channels/                 Resend, Twilio WhatsApp, Slack, webhooks
      scheduling/               prospect timezone -> next business slot
      i18n/                     viewer and message translations
  trigger/                      Trigger.dev tasks
```

Folders are created as each step lands; only the ones with code exist today.

## Follow-up engine

- Hot pricing follow-ups are queued while the prospect reads (`/api/track`),
  hot lead alerts when a view starts (`/api/track/start`).
- Anti-ghosting scans and sending run in `runClosingTick()`, exposed at
  `POST /api/cron/closing` (header `Authorization: Bearer $CRON_SECRET`).
- `src/trigger/closing-tick.ts` calls that route every 5 minutes. In the
  Trigger.dev project set `APP_URL` and `CRON_SECRET`, then
  `npx trigger.dev@latest deploy`.
- Without AI keys, messages use built-in templates. Without an email provider
  or Twilio, follow-ups are generated but marked as failed when sent.
- Locally, the document page has test tools to run the engine and simulate an
  old link.

```bash
npm test   # scheduling, scoring, prompts
```

## Notes

- PDF rendering uses pdf.js (Apache 2.0) and text extraction uses unpdf (MIT).
  No AGPL code (Papermark, mupdf) is copied into this repo.
- Viewer IPs are only stored as salted hashes.
