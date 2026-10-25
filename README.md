# ClozerClub

Four independent packages, no workspace: each has its own `package.json` and
`package-lock.json`. Run every command from the package directory.

| Directory | Deployed on | What it is |
|---|---|---|
| [`app/`](./app) | `app.clozer.club` | The product: tracked PDF proposals, reading analytics, follow-up engine |
| [`landing/`](./landing) | `www.clozer.club` | Marketing site |
| [`extension/`](./extension) | Chrome Web Store | Chrome extension for Gmail and Outlook web |
| [`outlook/`](./outlook) | served by the app under `/outlook` | Office add-in for installed Outlook |

```bash
cd app && npm install && npm run dev        # :3000
cd landing && npm install && npm run dev    # :3000, so run one at a time
```

More docs: [`docs/i18n.md`](./docs/i18n.md) (translations) and
[`docs/security/`](./docs/security) (security answers and runbooks).

CI (`.github/workflows/ci.yml`) checks every package in parallel.
`closing-tick.yml` pings the production follow-up engine every 5 minutes and
does not touch this repo.
