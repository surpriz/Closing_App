/**
 * English version of HELP_GUIDE (guide.ts), same sections in the same order.
 * Update both when a feature changes what a user sees or can do.
 */
export const HELP_GUIDE_EN = `## What Clozer is
- Clozer replaces the attachment with a tracked link. The seller uploads a document (quote, proposal,
  PDF deck, web page or video pitch), creates one link per prospect and sends it.
- Clozer sees how the prospect reads, works out where the sale stands and prepares the right follow-up at the
  right time. The seller approves it and calls the ones who are ready.
- Sign-in by email, no password. The prospect reads in their browser, on desktop or phone, without installing
  anything.
- Reads by the seller while signed in to Clozer don't count, nor do bots or automatic previews (Slack,
  LinkedIn).
- Main navigation (tabs at the top, bar at the bottom on phone): Today (/dashboard), Documents (/documents),
  Settings (/settings). Team (/team) is added for owners and admins as soon as the workspace has a second
  member (otherwise: Settings → Team → “Invite a sales rep”, and /team stays reachable by its URL).
  Prospecting (/prospecting) only exists for workspaces where it's turned on.
- “?” button at the top right: Ask a question (the help assistant, also for suggestions and bugs), How it works
  (/how-it-works), FAQ (/faq), Replay onboarding (/welcome).
- Account menu (avatar at the top right): Data and privacy (/settings#donnees), theme picker, Sign out.

## A prospect's journey
1. You upload a document. Clozer reads it once: type, summary of each page, where the price, timeline and scope
   are, and the precise facts (“$12,000”).
2. The prospect opens their link. Clozer records page by page the time spent, when, on which device, and
   whether others open it. On Clozer, you see them reading live.
3. A few minutes after the read, Clozer rebuilds the sale's story as dated facts and an AI interprets it: where
   the sale stands, what's stuck (price, decision-maker, timing…), what to do. Every conclusion cites its facts;
   anything unproven is left out.
4. If a follow-up is needed, Clozer writes the message in your name, with your offer and the real figures from
   the document. Never “I saw you looked at the pricing”.
5. It picks the moment: never right after a read, always during the prospect's business hours, 3 follow-ups
   per month at most, nothing right after an interaction you logged.
6. By default the follow-up waits for you (email + “Follow-ups to review”). On Autopilot, only confident
   follow-ups go out on their own. The prospect's replies land in your inbox.
7. It keeps watching: 3 days of silence, 7 days, it takes stock again and adjusts what comes next. Link never
   opened: reminders on day 3 and day 7, then on day 14 a last message offering to close the file (always
   approved by you). If they clicked but stopped at the email screen, the reminder makes it easy to get in. The prospect clicks “Approve” or “Request changes”: everything
   stops and you get notified.
- Prospect statuses: Open, Approved, Changes requested, Won, Lost.

## Two indicators: temperature and AI read
- Temperature (out of 100, Hot / Warm / Cold): how much they read. Computed without AI: recent read, time
  spent, repeat visits, several readers, pricing read, read to the end, requests, meetings. Each point has its
  reason (“Why” block on the prospect's page).
- AI read (with its confidence): what it means. A prospect can be “hot” with a cautious AI read (short reads,
  too early to tell). Low confidence when there are few signals.
- Actions suggested by the AI read: Follow up in writing, Call, Answer their request, Bring the decision-maker
  in, Wait, Mark as lost.

## Today (/dashboard)
- The home page. A seller sees their own prospects there; the whole team's view is on Team.
- Getting started (3 steps checked off from your real data): Upload a document, Send the link, The prospect
  opens it. To test, open your link in a private window: your own signed-in reads don't count.
- At the top: a sentence summing up the day, the “Add a document / link” button, and “Reading now” when a
  prospect is reading right now.
- “Autopilot” banner (if Autopilot is on): how many follow-ups went out on their own in the last 24 h, and for
  owners and admins the “Review everything myself” button that switches everything back to manual approval.
- To do: your prospects from most to least urgent (15 shown), with their state (Hot, Warm, Cold, Not opened yet,
  Approved…), the suggested action and a button to copy the link, or “Mark as won” when the prospect approved.
- Your sends: funnel of sent, opened, read carefully, approved, over 7 days, 30 days or All. “Read carefully”
  = half the PDF with at least 30 s of reading, one minute on a web link, or a long pricing read.
- Right column: Active prospects (split by temperature), Follow-ups to review (leads to the prospect's page, Follow-ups
  section), What happened, Upcoming follow-ups.

## Documents (/documents)
- Add: “Add a document / link” button, or drop a PDF / paste a link anywhere on the Documents page.
- Files: PDF only, 25 MB max. A Word or PowerPoint file must be exported to PDF first.
- Web link: paste a full URL (Notion, Loom, Figma, Webflow…). If the site refuses to be embedded, the prospect
  opens it in a new tab.
- “Record a video pitch”: up to 3 minutes, Camera or Screen + camera. The prospect sees the video full size with
  your meeting and quote buttons, and you know how far they watched. The transcript feeds the AI and the
  assistant.
- Right after upload, a ready-to-send link opens (share screen): no need to wait for the analysis to finish.
  If the document already existed, Clozer simply creates a new link.

## Document page (/documents/[id])
- “A link for another prospect” button (“Create the link” while the document has none): one more link for another prospect.
- Prospects tab: one link per prospect, with its state, its reads, a “Follow-ups” toggle per link and the copy
  button.
- Reads tab: “What's blocking” (across all prospects of this document), “Time spent per page” (pricing pages
  highlighted), automatically detected pages, “Latest reads”. For a web link: time spent on the page only; for a
  YouTube or Vimeo video, also how much was actually watched; for Loom, time on the page only.
- Anonymous readers: same letter = same browser, two letters = often two people. To know exactly who is
  reading, turn on “Ask for their email before reading” in the link settings.
- The document tab:
  - Welcome message: video or voice message the prospect sees on opening, on every link of this document (not
    for a video pitch).
  - Document type (Quote, Sales proposal, Presentation, Technical document, Resume / profile, Invoice, Contract,
    Case study, Brochure, Document): guessed by the AI, editable; it sets the wording of tags and of the
    assistant.
  - Info for the assistant: details specific to this document to answer the prospect's questions (4,000
    characters max).
  - Content: AI summary of each page, with tags (Pricing, Terms, Timeline, Scope, Team, Case studies, Other).
    Fix them if needed: your choice won't be touched again. “Reread the pages” button if the AI didn't manage.
    For a web page: “What the page presents” and “Reread the page”.
  - Preview: the document as the prospect sees it.
- Follow-ups tab: follow-ups and alerts for all prospects of the document.
- Delete the document (owners and admins): it disappears, none of the links sent will open anymore and their
  scheduled follow-ups are canceled. It's permanently erased after 30 days.

## Link share screen
- Shows right after upload or “A link for another prospect” (“Create the link” while the document has none), as long as the link hasn't been sent. “Your link
  is ready”.
- By default, a link for one person. At the bottom of the screen, “Make it a link open to everyone” makes it
  shared. Link open to everyone = shared link (brochure, LinkedIn post, email signature): each reader gives
  their email and gets their own link, tracked as a prospect; their follow-ups still wait for your go-ahead. A link
  that has already been read or assigned to a contact can't become shared: create a new one.
- “Who is this link for?” field at the top (optional): an email adds the contact, a name just names the link
  (and the prospect).
- A “For a prospect” link opens directly, without asking the reader for an email: it was made for them. You can
  still require it link by link in “Customize”. A forwarded link is detected as a new reader.
- “Copy link” or “Send by email” don't count as sending: the link moves to “Link copied” and tracking starts on
  the first open, or when you click “It's sent”. A copied link never opened: after 2 days, the “links not opened
  yet” row asks “Did you actually send it?”. “Never opened” follow-ups only go out after a confirmed send, and
  never on their own, even on Autopilot.
- Today, “To send” section: links never copied or sent, with their document, “Copy link”, “Who for” and
  “Remove” (deletes a useless link, a duplicate). A copied link leaves the section and joins “links not opened
  yet” under “To do”. Uploading the same file again reuses its pending link instead of creating another one.
- Also: “Customize” (welcome message) and “See what the prospect will see”. For a quote or a proposal, a
  deadline can be set by default: the prospect sees a countdown.

## Prospect page (/links/[id])
- Header: company or contact name, the link to copy, the “Prospect status” picker, “Link settings” and “Archive
  link”. Changing the status (other than Open) cancels pending follow-ups.
- A coworker's prospect: viewable, but only its sales rep and admins can edit it.
- Prospect who approved: “approved… Confirm the sale to stop follow-ups” banner with “Mark as won”.
- Expired link: red banner, the prospect can no longer open it; extend it to reactivate it.
- “Reading now” banner as soon as a reader is on the document (nothing shown otherwise).
- The verdict, a single block at the top: temperature badge (Hot, Warm, Cold, “Not read yet”), “read … ago”,
  number of reads, then the AI read sentence (or, without an analysis, the temperature and its two strongest
  reasons), then the suggested action (same as on Today) with “Prepare a follow-up”, “See the ready follow-up”
  or “Analyze this prospect”.
  - “Why this temperature” section: score out of 100, gauge, each reason with its points, “How the temperature
    is calculated”.
  - “Analysis details” section: date, “N% confident”, stage and momentum, “What matters”, “What's stuck” with
    their source facts, “What to watch”, “Reanalyze” (at most every two minutes), “The N facts read by the AI”.
- Follow-ups (#relances), Prospect questions (#questions, asked to the assistant), Voice comments (#vocaux),
  Welcome message (#mot-accueil, personal version for this prospect possible), Page capsules (#capsules),
  “Detailed reading” (collapsed: time per page or per part of the video, shown only when there's enough
  reading), Activity (full timeline).
- Right column:
  - Prospect: the contacts who receive follow-ups, each with what they read (first read, last, duration), their
    role (Decision-maker, Finance / procurement, Technical…) guessed from the email or picked by you; open a
    contact to edit it (email, name, company, mobile phone, “Agrees to be contacted on WhatsApp”); “Add a
    contact”; then “Other readers” (#qui-lit), grouped by company or network. For a shared link: “Readers”, each
    with their own link.
  - Sales context (collapsed; your team sees it, the prospect doesn't): Amount at stake, Currency, Decision expected
    by, Decision-maker, Their role, Your notes. Notes feed the analysis, never the writing of a message. The
    summary (amount · deadline · decision-maker) stays visible on the collapsed row.
  - “Pause until” (in Sales context): the prospect will get back to you later, Clozer stays quiet until then.
    “Resume” to cancel.
  - Log an interaction: Call, Reply received, Meeting, Note, with “What was said” and “When” (empty = now),
    “Log interaction” button. Clozer takes it into account and won't follow up right after.
- Expiration: in “Link settings” (#expiration opens the dialog): None, 48 h, 7 days, 15 days, 30 days or Specific
  date; buttons +3 d, +7 d, +14 d, “Other date”, “Remove”. A link that expires shows “Expires in …” under the
  title. The prospect on an expired link can “Ask for an extension”: you get notified.
- Link settings (“Every change is saved right away”): Link name, “Ask for their email before reading”, and what
  the prospect can do: “Approve or request changes” (two buttons at the bottom of the document; “Request a
  quote” under a video), “Book a meeting”, “Ask the assistant”, “Leave a voice note on a page” (PDF),
  “Follow-ups prepared by Clozer” (off: the prospect stays tracked, with no follow-up). “Calendar link”: empty =
  your calendar from Settings. Owners and admins: “Keep these settings for my next links”.
- Archive link: the prospect can no longer open the document, scheduled follow-ups are canceled.

## Settings (/settings)
- The essentials are visible right away: Chrome and Outlook, Autopilot, Notifications, Your calendar. The
  “Advanced settings” button expands the rest: Your offer, Your links, Prospect assistant, Your messages, Team, Data. A
  direct link to an advanced section (/settings#offre…) expands it on its own.

## Follow-ups and Autopilot
- Settings → Autopilot (/settings#pilote), set by owners and admins for the whole workspace. Two modes:
  - “I review and approve” (Copilot, default, recommended to start): email + follow-up in “Follow-ups to
    review” and on the prospect's page, Follow-ups section.
  - “It goes out on its own when Clozer is confident” (Autopilot): tricky cases (objection, message from the
    prospect, doubt) still wait for your approval. A second AI check runs before every automatic send. A recap
    arrives each morning.
- Rules always followed: never a hint that you can see what they read (a check blocks any sentence that would
  give it away); never a figure or a date that isn't in the document; 3 follow-ups per month per contact at
  most, spaced out; never in the hours after a read, always during the prospect's business hours; only one
  follow-up being prepared per prospect (a newer analysis replaces the old one); your private notes are never used
  for writing.
- On a follow-up: edit the subject and message then “Save”; “Rewrite” with Shorter, More direct, Suggest a
  call, Different angle, or your own instruction; “Approve” (it goes out at the scheduled time, prospect's time
  zone); “Send now”; “Copy” or “Open in my email app” then “I sent it myself”; “Cancel”. An expired link must
  be extended before following up.
- An unsubscribe link is added to every send.
- Send time: the hour this prospect usually reads (otherwise your prospects' hour), within their business hours,
  a few minutes past the hour.
- Prospect replies: Clozer spots them when the prospect answers a follow-up (you still get the reply as before)
  or, with the extension, when you open the thread in Gmail. Automatic follow-ups stop, and the prospect's page
  shows “Email reply on…” with “Resume follow-ups”. Invalid address (bounce): nothing more goes to it and
  you're told.
- Follow-ups to review (/drafts): every follow-up waiting for your OK, “Approve” one by one or “Approve all”.
  Each one is checked again at send time.
- Stop follow-ups: for the whole workspace, “Review everything myself” on Today or switch back to “I review and
  approve”; for one prospect, the “Follow-ups” toggle (document's Prospects tab) or “Follow-ups prepared by Clozer”
  in the link settings, “Pause until”, or a status other than Open. For new links: Settings → Your links →
  “Prepare follow-ups”.

## Prospect assistant
- On the document, it answers the prospect's questions when you're not around. It relies on the document
  (summaries, facts, page text, video transcript), your offer (Settings → Your offer), the document's “Info for
  the assistant” and “What the assistant should know” (Settings → Prospect assistant, /settings#assistant,
  4,000 characters). Never on a made-up price or term.
- Whatever it doesn't know, it passes to you right away: “Prospect question” alert, question flagged on the
  prospect's page and included in the morning digest.
- Anything you write for the assistant can be obtained by the prospect by asking: nothing confidential.
- Turning it on: “Turn on the assistant for new links” in Settings, then link by link (“Ask the assistant”).
  With no AI configured, the assistant stays hidden.
- Conversations show up on the prospect's page, “Prospect questions” section. Your own tests on your link don't
  count.

## Welcome message, capsules and voice comments
- Welcome message: video or “Audio only”, up to 90 seconds, with an optional hook line. The prospect sees your
  bubble on opening, on every page. Document version (document page, The document tab) or personal version for
  one prospect (“Personal version for this prospect”, on the prospect's page), which replaces the document's.
- Page capsules: older page-by-page explanations, still played on their page.
- Voice comments: the prospect records a voice note on a page (60 s max); you get the audio and its transcript
  (“Voice comments” section + alert). Turn it on with “Let the prospect record a voice note on a page” (Settings
  → Your links) or link by link.

## Chrome extension and Outlook add-in
- Settings → Chrome and Outlook (/settings#extension). How it works: you attach a PDF in Gmail or Outlook,
  Clozer swaps it for a link, with the first recipient as the prospect.
- Chrome extension (Gmail and Outlook in the browser, on Chrome or Edge): install it, pin it (puzzle icon),
  click Clozer then “Connect”; the “Connect the extension” page opens, sign in if needed and click “Connect the
  extension”. The “C” button in the email also lets you pick an existing document.
- Outlook add-in (desktop Outlook on Windows or Mac): download the manifest file (link in Settings or the
  onboarding), then Outlook › Add-ins › My add-ins › Add from file. In a new email, click “Clozer” in the
  ribbon: a code shows up; enter it on the “Connect Outlook” page (Code shown in Outlook). IT can deploy it for
  the whole team through the Microsoft 365 admin center.
- Connections listed in Settings → Chrome and Outlook (one Chrome card, one Outlook card), with “Revoke” (confirmation required).
- Not covered yet: attachments from Drive or OneDrive, forwarded attachments. Use the “C” button or upload the
  PDF to Clozer.
- Other email app: upload the PDF to Clozer, then copy the link or “Send by email”.

## Notifications (Settings → Notifications, /settings#alertes)
- These settings only apply to you:
  - “An email as soon as a prospect approves, requests changes or books a meeting”: these alerts (plus
    questions to the assistant, voice notes, extension requests) arrive even in the evening and on weekends.
  - “When it's time to call”: “Chrome extension notification” and “An email too” (if the extension isn't
    open). First open, return after a quiet spell, long pricing read, several people reading. Never in the
    evening or on weekends, 4 per hour at most.
  - “A digest every morning at” 6 to 10 a.m.: who to get back to today and why, then yesterday's replies and
    reads. Monday to Friday, nothing if there's nothing to say.
- For the whole team (owners and admins): “For the whole team, also notify in” Slack and/or External tool;
  “CC on alert emails”; “Connect Slack or an external tool”: Slack webhook URL, and Webhook (CRM, Zapier,
  Make…) signed with HMAC SHA-256 (header X-Closing-Signature).
- Your calendar (/settings#agenda, personal): booking link. Calendly and Cal.com show up inside the page your
  prospect reads (name and email prefilled); others (HubSpot, Google Calendar…) open in a tab. Empty: no “Book a meeting”
  button.

## Other workspace settings
- Your offer (/settings#offre): What you sell, Your customers, Why they pick you, Objections you often hear,
  usual length of a sale in days. Optional: Clozer prefills it when it reads your first document.
- Your links (/settings#liens): what each new link offers by default. “Ask the reader for their email before
  opening”, expiration for a quote or a proposal (7, 15, 30 days or never; the countdown only shows on quotes and
  proposals), voice notes, “Prepare follow-ups”. Can be changed afterward link by link.
- Your messages (/settings#messages): Signed by, Tone (e.g. “direct, friendly, no jargon”), Signature.
- After a change: “Save settings”.

## Team and roles
- Roles: Owner, Admin, Member.
- Member: sees their own prospects on Today, views coworkers' prospects without editing them, sets their own
  notifications and calendar. Workspace settings grayed out (“Set by a workspace admin.”).
- Admin: sees the whole team on the Team page, configures the workspace, edits every prospect, deletes documents,
  invites and removes members.
- Owner: same as an admin, plus links without an assigned sales rep, the ability to make someone else owner and
  to delete the workspace.
- Team page (/team): Open, Moving, Slipping, To close out, Pipeline figures; “By sales rep” table (click to
  filter); columns Moving (watch closely), Slipping (cooling down), To close out (one last follow-up, or close
  it). These words describe the sale's life; the temperature (Hot, Warm, Cold) stays the dashboard's.
- Invite: “Invite a sales rep” or Settings → Team (/settings#equipe), email + role (Member or Admin), “Invite”.
  Change a role, “Remove” a member, cancel an invitation.

## Results (/results)
- What gets your prospects to answer, over 90 days: by follow-up type, by AI goal and by time received, how many
  were sent, reopened from the follow-up, answered, and followed by a meeting within 14 days.
- Won and lost deals (180 days, medians): reading time, visits, readers, pricing read, time to decide. Why deals
  were lost: picked in one click when you mark a deal Lost.
- Alert response time: how long before the deal was opened after an alert. A seller sees their own deals; an
  admin sees the team or “My deals”.
- Once a booked meeting's date has passed, the prospect's page asks whether it happened: “No-show” or
  “Cancelled” puts follow-ups back on. “Prepare the call” on the prospect's page gives what to say, ask and answer.

## Data and privacy (/settings#donnees)
- The prospect is informed: a clear notice appears on the document page, with a link to the privacy policy.
  Follow-ups never mention a page or a reading time.
- No email or IP address is sent to the AI: readers are shown by a letter.
- Read tracking erased 12 months after a link's last activity; deleted document permanently erased after 30
  days.
- Prospect request (owners and admins): look up their email, then “Export” or “Delete everything” (reads,
  messages, voice notes, follow-ups). Signed approvals are kept 5 years as proof of the agreement. Reply within
  a month.
- “Export workspace” (owners and admins): links, prospects, reads and messages as JSON.
- “Delete my account” (type DELETE): your prospects stay in the workspace, your access goes away.
- “Delete workspace” (owner, type the workspace name): everything is erased, files included, for the whole team.
  Can't be undone: export first.

## Known limits
- Follow-ups are sent from Clozer's address, with your email as the reply-to.
- Email replies: seen for follow-ups Clozer sent and, with the extension, in your Gmail threads. A reply to your
  own email in Outlook isn't seen: log it (“Log an interaction” → Reply received).
- WhatsApp follow-ups are coming soon.
- Files: PDF only, 25 MB max. On a web link, no page-by-page detail.
- AI: Claude Haiku (by Anthropic) reads documents and runs the second check before every automatic send; Claude
  Sonnet analyzes each prospect and writes the follow-ups. An analysis only reruns when something new has happened.

## Tips for getting the most out of Clozer
- One link per prospect: you'll know who's reading. Shared link only for wide distribution (brochure, post).
- Send the link instead of the attachment, not on top of it.
- Fill in Your offer and Your messages: follow-ups are more accurate and signed like you.
- Start with “I review and approve”, switch to Autopilot once you trust the drafts.
- Log your calls, meetings and replies: Clozer avoids following up at the wrong moment and the analysis stays
  accurate.
- Fill in the Sales context (amount, deadline, decision-maker): better analysis, accurate pipeline.
- Check page tags, Pricing especially: they count for the temperature and follow-ups.
- Feed the assistant (terms, guarantees, FAQ) and read the questions asked: they reveal the objections.
- Turn on “Ask for their email before reading” if the document circulates internally at the prospect's company.
- Call when the “time to call” alert arrives: what counts is during or right after the read.
- Mark Won or Lost as soon as it's settled: follow-ups stop.

## Help and suggestions
- The help assistant (“?” button at the top right → “Ask a question”, or Cmd+K) answers questions about Clozer
  and, with your OK, passes your suggestions, bugs, feedback and the questions it couldn't answer on to the
  Clozer team. The team reads everything and can reply by email.
- It sees neither your documents nor your prospects and can't change anything for you.
- FAQ (/faq): all the common questions, by topic, with search. From the account menu, Cmd+K or How it works.

## Shortcuts
- Cmd+K (Ctrl+K on Windows) or “Search…” at the top: go to a prospect, a company, a document or a page (Today,
  Documents, How it works, Settings, Onboarding), or “Ask a question”.
- Replay onboarding (/welcome): from the “?” button or How it works. Three steps: Your email, The tool
  (extension, add-in or nothing), You're set (offer, first document).
`;
