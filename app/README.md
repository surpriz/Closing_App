# Clozer app

Turn PDF proposals into tracked links, see how prospects read them, and send
follow-ups based on that behavior.

Stack: Next.js 16 (App Router), TypeScript, Tailwind 4, shadcn/ui on Base UI,
Prisma 7 on Neon, Better Auth (magic link + Google), private Vercel Blob,
AI SDK 7 (OpenAI or Anthropic), Amazon SES, Stripe.

## Setup

All commands run from this directory (`app/`), not the repo root.

```bash
cp .env.example .env.local   # fill in values, staging database only
npm install                  # also runs prisma generate
npm run dev
npm test
```

Locally the login page shows an "open magic link" button instead of sending
email.

## Follow-up engine

`runClosingTick()` is exposed at `POST /api/cron/closing` (header
`Authorization: Bearer $CRON_SECRET`). The live caller is the GitHub Actions
cron (`.github/workflows/closing-tick.yml`, every 5 minutes).
`src/trigger/closing-tick.ts` does the same from Trigger.dev but is not
deployed.

Without AI keys, messages use built-in templates.

## Notes

- PDF rendering uses pdf.js (Apache 2.0) and text extraction uses unpdf (MIT).
  No AGPL code (Papermark, mupdf) is copied into this repo.
- Viewer IPs are only stored as salted hashes.
