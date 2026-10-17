# Chrome Web Store listing (English)

English listing, the default one (`default_locale: "en"`). The French listing and the privacy practices are in `listing.md`: keep both in step with each other, with the privacy page and with `wxt.config.ts`.

## Store listing

- **Name**: Clozer
- **Summary** (≤ 132 chars, = `extDescription` in `public/_locales/en/messages.json`): Replace a PDF attachment with a Clozer link in Gmail and Outlook, and know when a prospect reads your proposal.
- **Category**: Productivity › Tools
- **Language**: English
- **Website**: https://www.clozer.club
- **Support**: https://www.clozer.club/support
- **Visibility**: Public

**Description**

```
Sending a sales proposal as a PDF? With Clozer, it goes out as a link, and you know when the prospect opens it, how long they spend on it and which pages they read.

In Gmail or Outlook on the web, attach your PDF as usual. Clozer offers to replace it with a link made for that recipient, inserts it above your signature and removes the attachment. The "C" button in the corner of the message also lets you pick a document already in Clozer.

While the prospect reads, the extension lets you know: it's the right time to call.

You need a Clozer account (https://app.clozer.club). The extension doesn't read the emails you receive and doesn't send the text of your messages: only the PDF you replace and the first recipient.
```

**Images** (`store/images/`): same icon and promo tiles as the French listing. Screenshots 1280×800, 1 to 5, taken with Chrome and Gmail in English (`./fit-screenshot.sh capture.png`):

1. Gmail compose with the PDF attached and the Clozer offer
2. The link inserted above the signature, attachment removed
3. The "Reading now" notification
4. The reading report in the app

**Privacy practices**: entered once for the item, not per language. The English answers to paste are below; the French ones are in `listing.md`.

**Single purpose**

```
Replace a PDF attachment in an email being written (Gmail, Outlook web) with a Clozer tracking link, and let the seller know when their prospect reads that link.
```

**Permission justifications**

| Permission | Justification |
|---|---|
| `storage` | Keep the Clozer account sign-in token and the user's preferences. |
| `notifications` | Let the seller know that a prospect is reading their proposal. |
| `alarms` | Ask Clozer every 30 seconds whether a prospect is reading right now. |
| `idle` | Don't ask Clozer while the computer session is locked. |
| Host `https://app.clozer.club/*` | Only server contacted: the Clozer API (sign-in, PDF upload, link creation, reading activity). |
| Content scripts on `mail.google.com`, `outlook.office.com`, `outlook.office365.com`, `outlook.live.com`, `outlook.cloud.microsoft` | Find a compose window, show the Clozer button and insert the link in the message. No other site. |
| Script in the page world (`world: MAIN`) | Gmail and Outlook add files through an `<input type=file>` created and clicked by their own code, invisible to an isolated script. The script watches that click to detect an attached PDF and hands it to the isolated script. It neither blocks nor changes how the mail app behaves. |
