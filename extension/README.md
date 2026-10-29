# Clozer for Gmail and Outlook

Chrome extension (Manifest V3, built with [WXT](https://wxt.dev)). When a seller attaches a PDF to an email in Gmail or Outlook web, it offers to replace it with a Clozer link: it uploads the PDF, creates the link with the first "To" recipient as prospect, inserts it above the signature and removes the attachment. The "C" button in the corner of the message picks an existing document instead.

## Commands

```bash
npm install
npm run dev            # Chrome with the extension, against http://localhost:3000
npm test               # vitest (helpers + adapters on simplified DOM fixtures)
npm run typecheck
npm run build          # production -> .output/chrome-mv3 (app.clozer.club)
npm run build:staging  # staging    -> .output/chrome-mv3-staging (staging.clozer.club)
npm run zip            # Web Store upload (listing copy: store/listing.md)
```

To load a build by hand: `chrome://extensions` → Developer mode → Load unpacked → the `.output/...` folder. Branded Chrome ignores `--load-extension`, so scripted tests use Chrome for Testing.

## How it fits together

- `src/entrypoints/background.ts` is the only part that talks to the app (`/api/ext/*`, Bearer token). It holds the token in `chrome.storage.local` and uploads PDFs straight to Vercel Blob through `/api/ext/upload`.
- `src/entrypoints/capture.content.ts` runs in the page (MAIN world) at `document_start`. Gmail and Outlook attach files through a hidden `<input type=file>` they create and `click()`, so it hooks that call and forwards PDFs to the isolated script. It never blocks the mail app.
- `src/entrypoints/mail.content.ts` finds open composes, shows the button and panel (shadow DOM overlay positioned over the message body, not injected into the mail app's markup), and runs the replace flow.
- `src/adapters/mail.ts` holds every Gmail and Outlook selector. All lookups may return null: the extension then does less, never breaks the compose.

## Connecting

The popup opens `/extension/connect?nonce=…` on the app. The seller signs in if needed, clicks "Connecter Clozer", and the page hands a token to the extension through `externally_connectable`. Only the hash is stored server side (`extension_tokens`). Tokens are listed and revocable in Settings.

The app only sends tokens to extension IDs listed in `EXTENSION_IDS`. Dev and staging builds pin their ID with `WXT_MANIFEST_KEY` (public key, in `.env.development` / `.env.staging`): `oidkcbbpbinommpbbpabnlhlnffekbjb`. Production uses the Web Store ID, `fnefeeodeepechnhbijpfmjjcolopmmj` ([listing](https://chromewebstore.google.com/detail/clozer/fnefeeodeepechnhbijpfmjjcolopmmj)).

The staging build can sit next to the Store one ("Clozer (staging)", loaded unpacked from `.output/chrome-mv3-staging`). Both act on Gmail and Outlook, so switch one off in `chrome://extensions` while testing, or keep staging in its own Chrome profile.

## Releasing

1. Bump `version` in `package.json` (the Store refuses a version that does not go up).
2. Merge to `main`. CI keeps the zip as the `chrome-extension` artifact of the run (or `npm run zip`).
3. Developer dashboard → Package → upload → submit for review. Updates usually pass within a day, longer when a permission or a host is added. Untick automatic publishing to release it by hand, right after the matching app deploy.
4. Chrome updates installed copies on its own within hours. The API must keep serving the previous version meanwhile.

## When Gmail or Outlook breaks it

1. Switch the host off without a release: `EXTENSION_DISABLED_HOSTS=gmail` (or `outlook`) on the app, or force an update with `EXTENSION_MIN_VERSION`. Older versions then stop acting and show "Clozer doit être mis à jour" (from 1.1.0), whose button asks Chrome for the new version right away.
2. Save the compose HTML (DevTools → Copy outerHTML of the compose), update the fixture in `src/adapters/mail.test.ts`, fix `src/adapters/mail.ts`.

## Not covered yet

- Attachments added from Drive or OneDrive, forwarded attachments, or attached before the page finished loading: use the "C" button.
- Gmail and Outlook selectors are only tested against simplified fixtures. Check them in the real apps before each release.
