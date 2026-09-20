# ClozerClub

Two independent Next.js packages, one per domain. No workspace: each has its own
`package.json` and `package-lock.json`, and its own Vercel project.

| Directory | Domain | What it is |
|---|---|---|
| [`app/`](./app) | `app.clozer.club` | The product: tracked PDF proposals, reading analytics, follow-up engine |
| [`landing/`](./landing) | `www.clozer.club` | Marketing site |

Install and run each one from its own directory:

```bash
cd app && npm install && npm run dev        # :3000
cd landing && npm install && npm run dev    # :3000, so run one at a time
```

CI (`.github/workflows/ci.yml`) checks both in parallel. `closing-tick.yml` pings
the production follow-up engine every 5 minutes and does not touch this repo.
