# Clozer for Outlook

Office add-in (Office.js) for Outlook installed on Windows (classic and new Outlook), on Mac, and on the web. It does what the Chrome extension does in Gmail and Outlook web, for people who don't work in a browser:

- the seller attaches a PDF and it becomes a link on its own, pane closed. The event handler uploads the PDF, creates a draft link with the first "To" recipient as the prospect, inserts it where the seller was typing and removes the attachment. Progress and outcome show in Outlook's bar above the email. An add-in can't show a yes/no prompt without opening the pane, so asking first is a setting in the pane ("Me demander d'abord"). With that setting, the bar asks, and its action opens the pane, which does the job;
- from the pane, the seller can also insert an existing document or a PDF from disk;
- on send, the links still in the body are confirmed (`/api/ext/links/[id]/sent`). The handler never blocks the send;
- while the pane is open or pinned, it shows who is reading and the alerts (`/api/ext/pulse`).

## How it is served

There is no separate host. `app/scripts/vercel-build.mjs` builds this package into `app/public/outlook/`, so the add-in lives at `https://app.clozer.club/outlook/*`, on the same origin as `/api/ext/*`. The manifest for each environment is generated at build time: `/outlook/manifest.xml`.

| Mode | Origin | Add-in ID |
|---|---|---|
| development | https://localhost:3000 | `.env.development` |
| staging | https://staging.clozer.club | `.env.staging` |
| production | https://app.clozer.club | `.env.production` |

## Connecting

Outlook can't see the browser session, so connecting works like pairing a TV. The pane asks for a code (`POST /api/ext/pair`), then opens `/extension/outlook` in the browser. The seller types the code there (never pre-filled from the URL, so a link sent by someone else cannot pair their Outlook), and the pane polls `/api/ext/pair/poll` until it gets its token. The token is the same kind the Chrome extension uses (`ExtensionToken`, labelled "Outlook · complément"). It is stored in the mailbox's roaming settings, so it follows the seller to every Outlook they use.

## Files

- `manifest/manifest.xml` is the template (XML add-in-only manifest). Clients below Mailbox 1.12 get the button and pane only. From 1.12 they also get the pinnable pane, `OnMessageSend`, and from 1.13 `OnMessageAttachmentsChanged`.
- `src/commands/` holds the event handlers, which do the replacement themselves (`src/lib/insert.ts`, shared with the pane). They are built as a single IIFE (`commands.js`), because classic Outlook on Windows runs them in a JavaScript-only runtime: no DOM, no modules, no localStorage.
- `src/taskpane/` is the pane.
- `src/lib/` holds the Office.js wrappers and the API client.
- Pure modules are imported from source in `../extension/src/lib` and `../extension/src/ui/dom.ts` (aliases `@ext`, `@extui`). Keep those files free of WXT and Chrome imports.

## Commands

```bash
npm test            # vitest
npm run typecheck
npm run build       # production → dist/ (OUTLOOK_OUT_DIR overrides)
npm run validate    # Microsoft's manifest validator on dist/manifest.xml (online)
npm run dev         # development build into ../app/public/outlook (rerun after a change)
```

## Trying it locally

1. `cd app && npx next dev --experimental-https`. Office requires https, even on localhost.
2. `cd outlook && npm run dev`.
3. Sideload `https://localhost:3000/outlook/manifest.xml`. In Outlook on the web: https://aka.ms/olksideload → My add-ins → Add from file. In the new Outlook or on Mac: Get Add-ins → My add-ins → Add a custom add-in. On classic Windows, the same menu is under Home → Get Add-ins.

## Debugging

The development build logs each step of the event handlers to the local app (`/api/ext/log`, development only). The app writes them to `$TMPDIR/clozer-outlook.log`. Outlook on Mac caches add-in files: after each rebuild, quit Outlook and run `rm -rf ~/Library/Containers/com.microsoft.Outlook/Data/Documents/wef`.

## Rolling out to a customer

The customer's Microsoft 365 admin uploads the production `manifest.xml` in the admin center (Settings → Integrated apps → Upload custom apps) and assigns it to the sales team. It then shows up in every Outlook those users have, within a few hours.

## Kill switch

Add `outlook-addin` to `EXTENSION_DISABLED_HOSTS` in the app. The pane then shows "momentanément indisponible", and nothing needs redeploying.

## Not covered

- OneDrive or cloud attachments.
- System notifications while the pane is closed. The email and Slack alerts take over, as for a seller without the extension.
- Links in a draft reopened from the Drafts folder. `sessionData` only lives as long as the compose window. The first prospect open confirms those links.
