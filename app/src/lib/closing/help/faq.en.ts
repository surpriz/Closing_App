/**
 * English FAQ, same sections, ids and order as FAQ in faq.ts: ids are /faq
 * anchors and must match across languages. Update both when a feature changes.
 */
import type { FaqSection } from "./faq";

export const FAQ_EN: FaqSection[] = [
  {
    id: "demarrer",
    title: "Getting started",
    items: [
      {
        id: "cest-quoi",
        q: "What does Clozer actually do?",
        a: "Clozer replaces the attachment with a tracked link. You upload a document (quote, proposal, deck, web page or video pitch), create one link per prospect and send it.\n\nClozer sees how the prospect reads, works out where the sale stands and prepares the right follow-up at the right time. You approve it, and you call the ones who are ready.",
        link: { href: "/how-it-works", label: "How it works" },
      },
      {
        id: "par-ou-commencer",
        q: "Where do I start?",
        a: "Three steps, checked off automatically on Today under “Getting started”: upload a document, send the link, the prospect opens it.\n\nThen take five minutes to fill in Settings → Advanced settings → Offer and assistant, then Links and follow-ups: follow-ups will be more accurate and signed like you.",
        link: { href: "/documents", label: "Upload a document" },
      },
      {
        id: "installer",
        q: "Do I need to install anything?",
        a: "No. You sign in with your email, no password, and the prospect reads in their browser, on desktop or phone, without installing anything.\n\nThe Chrome extension and the Outlook add-in are optional: they turn a PDF attachment into a Clozer link right in your inbox.",
      },
      {
        id: "tester",
        q: "How do I test my link without skewing the numbers?",
        a: "Open your link in a private browsing window. Your own reads don't count while you're signed in to Clozer. Bots and automatic previews (Slack, LinkedIn) are filtered out too.",
      },
      {
        id: "prise-en-main",
        q: "How do I replay the onboarding?",
        a: "“?” button at the top right → Replay onboarding, or from the How it works page. Three steps: your email, the right tool (extension, add-in or nothing), and you're set.",
        link: { href: "/welcome", label: "Replay onboarding" },
      },
      {
        id: "recherche",
        q: "How do I quickly find a prospect or a document?",
        a: "Cmd+K (Ctrl+K on Windows), or “Search…” at the top of the screen: type a prospect, a company or a document, then Enter.",
      },
    ],
  },
  {
    id: "documents",
    title: "Documents",
    items: [
      {
        id: "formats",
        q: "What documents can I send?",
        a: "Three kinds:\n- a PDF (quote, proposal, deck, resume…), 25 MB max;\n- a web link (Notion, Loom, Figma, Webflow…): paste the full URL;\n- a video pitch recorded in Clozer, up to 3 minutes, camera only or screen + camera.",
      },
      {
        id: "word-powerpoint",
        q: "Can I send a Word or PowerPoint file?",
        a: "Not directly: export it to PDF first, then upload the PDF.",
      },
      {
        id: "ajouter",
        q: "How do I add a document?",
        a: "“Add a document / link” button on Today or Documents. On the Documents page, you can also drop a PDF or paste a link anywhere.\n\nA ready-to-send link opens right away: no need to wait for the analysis to finish.",
        link: { href: "/documents", label: "Documents" },
      },
      {
        id: "lien-web-bloque",
        q: "My web link doesn't show inside Clozer. Is that normal?",
        a: "Some sites refuse to be displayed inside another page. In that case, the prospect opens it in a new tab. You see the open and the time spent, but no page-by-page detail.",
      },
      {
        id: "pitch-video",
        q: "What is the video pitch for?",
        a: "You record up to 3 minutes (Documents → “Record a video pitch”). The prospect sees the video full size with your meeting and quote buttons, and you know how far they watched. The transcript feeds the analysis and the prospect assistant.",
      },
      {
        id: "comprehension",
        q: "How do I see what Clozer understood from my document?",
        a: "Document page → The document tab → Content: a summary of each page with tags (Pricing, Terms, Timeline, Scope, Team, Case studies, Other). If a tag is wrong, fix it: your choice won't be touched again. “Reread the pages” button if the AI didn't manage.",
      },
      {
        id: "etiquettes",
        q: "Why fix page tags?",
        a: "They count for the temperature and for follow-ups, Pricing especially: a pricing page that isn't spotted throws off the read on the sale.",
      },
      {
        id: "type-document",
        q: "What is the document type for?",
        a: "Quote, Sales proposal, Presentation, Technical document, Resume / profile, Invoice, Contract, Case study, Brochure or Document: the AI guesses it and you can change it (The document tab). It sets the wording of tags and of the assistant and, for a quote or a proposal, the default deadline.",
      },
      {
        id: "ce-qui-bloque",
        q: "What does a document's Reads tab show?",
        a: "“What's blocking” across all prospects of this document, time spent per page (pricing pages highlighted) and the latest reads. For a YouTube or Vimeo video, also how much was actually watched; for Loom, only the time spent on the page.",
      },
      {
        id: "supprimer-document",
        q: "How do I delete a document?",
        a: "From the document page (owners and admins). None of the links sent will open anymore and their scheduled follow-ups are canceled. The document is permanently erased after 30 days.",
      },
    ],
  },
  {
    id: "liens",
    title: "Links and sharing",
    items: [
      {
        id: "un-lien-par-prospect",
        q: "Why one link per prospect?",
        a: "So you know who's reading. Each link becomes a prospect, with its reads, temperature and follow-ups. On the document page, “A link for another prospect” (“Create the link” while the document has none) creates one more.",
      },
      {
        id: "lien-partage",
        q: "Can I send the same link to lots of people?",
        a: "Yes, with “Link open to everyone” on the share screen: it's a shared link, handy for a brochure, a LinkedIn post or an email signature. Each reader gives their email and gets their own link, tracked as a prospect; their follow-ups still wait for your go-ahead.\n\nA link that has already been read or assigned to a contact can't become shared: create a new one.",
      },
      {
        id: "envoyer",
        q: "How do I send the link?",
        a: "On the share screen: “Copy link” to paste it into your email, or “Send by email”. The “Who is it for?” field takes an email (the contact is added) or a name (the link is just named).\n\nSend the link instead of the attachment, not on top of it.",
      },
      {
        id: "voir-comme-prospect",
        q: "How do I see what the prospect will see?",
        a: "“See what the prospect will see” on the share screen, or Preview in The document tab of the document page.",
      },
      {
        id: "demander-email",
        q: "How do I know exactly who is reading?",
        a: "Turn on “Ask for their email before reading” in the link settings (a “For a prospect” link doesn't ask by default: it was made for one person). Without it, anonymous readers are shown by a letter: same letter = same browser.\n\nMost useful when the document circulates internally at the prospect's company.",
      },
      {
        id: "expiration",
        q: "How does link expiration work?",
        a: "On the prospect's page, “Link settings” → Expiration: None, 48 h, 7, 15 or 30 days, or a specific date. For a quote or a proposal, the prospect sees a countdown. After the deadline, the link no longer opens.\n\nThe default is set in Settings → Advanced settings → Links and follow-ups (7, 15, 30 days or never).",
      },
      {
        id: "prolonger",
        q: "How do I extend or reopen an expired link?",
        a: "Prospect page → “Link settings” → Expiration: +3 d, +7 d, +14 d or “Other date”. The prospect on an expired link can also click “Ask for an extension”: you get notified. An expired link must be extended before any follow-up.",
      },
      {
        id: "reglages-lien",
        q: "What can I set link by link?",
        a: "Prospect page → Link settings (every change is saved right away): link name, “Ask for their email before reading”, “Approve or request changes”, “Book a meeting”, “Ask the assistant”, “Leave a voice note on a page”, “Follow-ups prepared by Clozer” and the calendar link.\n\nOwners and admins: “Keep these settings for my next links”.",
      },
      {
        id: "archiver-lien",
        q: "How do I turn off a link?",
        a: "Prospect page → “Archive link”: the prospect can no longer open the document and scheduled follow-ups are canceled.",
      },
    ],
  },
  {
    id: "lecture",
    title: "Read tracking",
    items: [
      {
        id: "ce-que-je-vois",
        q: "What do I see of the reads?",
        a: "For a PDF, page by page: time spent, when, on which device, and whether other people open it. If you're on Clozer at the same time, you see them reading live (“Reading now”).\n\nFor a web link, the open and the time spent on the page.",
      },
      {
        id: "temperature",
        q: "What does the temperature mean?",
        a: "A score out of 100 (Hot, Warm, Cold) that says how much they read. It's computed without AI: recent read, time spent, repeat visits, several readers, pricing read, read to the end, requests, meetings. On the prospect's page, the “Why this temperature” section breaks down every point.",
      },
      {
        id: "temperature-vs-ia",
        q: "Why does a hot prospect get a cautious AI read?",
        a: "They answer two different questions. The temperature says how much they read; the AI read says what it means. Lots of short reads, or too early to tell: hot, but cautious. The AI read leads the prospect's page; the temperature stays as a badge, with its detail in “Why this temperature”. “N% confident” (in “Analysis details”) is low when there are few signals.",
      },
      {
        id: "lu-en-profondeur",
        q: "What does “read carefully” mean?",
        a: "Half the PDF with at least 30 seconds of reading, one minute on a web link, or a long pricing read. It's a step of the “Your sends” funnel on Today.",
      },
      {
        id: "plusieurs-lecteurs",
        q: "How do I know if several people are reading?",
        a: "“Prospect” block on the prospect's page: each contact with what they read, then “Other readers”, grouped by company or network, with their role (Decision-maker, Finance / procurement, Technical…), guessed from the email or picked by you. Two different letters = often two people.",
      },
      {
        id: "pas-de-lecture",
        q: "My prospect says they read it, but Clozer shows nothing. Why?",
        a: "Check that they actually opened the Clozer link and not an attachment sent alongside it. Automatic previews and bots don't count, and neither do your own opens while signed in. If the problem persists, report it through the help assistant.",
      },
    ],
  },
  {
    id: "deals",
    title: "Prospects and analysis",
    items: [
      {
        id: "aujourdhui",
        q: "What is the Today page for?",
        a: "It's your cockpit: a summary of the day, who is reading right now, “To do” (your prospects from most to least urgent, with the suggested action), your sends funnel, follow-ups to review, what happened and upcoming follow-ups.",
        link: { href: "/dashboard", label: "Today" },
      },
      {
        id: "lecture-ia",
        q: "What does the AI analysis of a prospect do?",
        a: "A few minutes after a read, Clozer rebuilds the sale's story as dated facts and an AI interprets it: “What matters”, “What's stuck” (price, decision-maker, timing…) and the suggested action. Every conclusion cites its facts; anything unproven is left out.",
      },
      {
        id: "actions-conseillees",
        q: "What actions can Clozer suggest?",
        a: "Follow up in writing, Call, Answer their request, Bring the decision-maker in, Wait, Mark as lost.",
      },
      {
        id: "reanalyser",
        q: "How do I rerun a prospect's analysis?",
        a: "Prospect page → “Reanalyze” (at most every two minutes), or “Analyze this prospect” if there isn't one yet. An analysis only reruns automatically when something new has happened.",
      },
      {
        id: "statuts",
        q: "What are the prospect statuses?",
        a: "Open, Approved, Changes requested, Won, Lost. Change it with the “Prospect status” picker at the top of the prospect's page. Any status other than Open cancels pending follow-ups.",
      },
      {
        id: "gagne",
        q: "The prospect approved. What should I do?",
        a: "A banner shows up on the prospect's page: click “Mark as won” to confirm the sale and stop follow-ups. Mark it Won or Lost as soon as it's settled.",
      },
      {
        id: "noter-echange",
        q: "I spoke to the prospect on the phone. Where do I log it?",
        a: "Prospect page → Log an interaction: Call, Reply received, Meeting or Note, with “What was said” and “When” (empty = now). Clozer takes it into account and won't follow up right after.",
      },
      {
        id: "infos-deal",
        q: "Where do I enter the amount, deadline or decision-maker?",
        a: "Prospect page → “Sales context” (collapsed, right column): amount, currency, decision expected by, decision-maker, their role and your notes. Your team sees it, the prospect doesn't. Notes feed the analysis, never the writing of a message.",
      },
      {
        id: "pause-deal",
        q: "The prospect told me to get back to them later. How do I pause?",
        a: "Prospect page → “Pause until”: Clozer stays quiet until that date. “Resume” to cancel.",
      },
      {
        id: "contacts",
        q: "How do I add or edit a contact?",
        a: "Prospect page → Contacts (they're the ones who receive follow-ups): edit a contact (email, name, company, mobile, WhatsApp consent) or “Add a contact”.",
      },
      {
        id: "deal-collegue",
        q: "Can I edit a coworker's prospect?",
        a: "You can view it, but only its sales rep, admins and owners can edit it.",
      },
    ],
  },
  {
    id: "relances",
    title: "Follow-ups and Autopilot",
    items: [
      {
        id: "relances-seules",
        q: "Do follow-ups go out on their own?",
        a: "Not by default. In “I review and approve” mode (Copilot), every follow-up waits for you: you get an email and it shows up in “Follow-ups to review” and on the prospect's page.\n\nIn “It goes out on its own when Clozer is confident” mode, only confident follow-ups go out on their own; tricky cases (objection, message from the prospect, doubt) wait for your approval.",
        link: { href: "/settings#pilote", label: "Settings → Advanced settings → Links and follow-ups" },
      },
      {
        id: "copilote-ou-auto",
        q: "Copilot or Autopilot: which should I pick?",
        a: "Start with “I review and approve”. Switch to Autopilot once you trust the drafts. On Autopilot, a second AI check runs before every send and a recap arrives each morning. The mode is set for the whole workspace, by owners and admins.",
      },
      {
        id: "quand",
        q: "When do follow-ups go out?",
        a: "Never right after a read, always during the prospect's business hours, 3 follow-ups per month per contact at most, spaced out, and nothing right after an interaction you logged.",
      },
      {
        id: "allusion-lecture",
        q: "Will the prospect guess that I can see what they read?",
        a: "No. Follow-ups never mention a page or a reading time, and a check blocks any sentence that would give it away. They never use a figure or a date that isn't in the document.",
      },
      {
        id: "modifier-relance",
        q: "How do I edit a follow-up before it's sent?",
        a: "On the follow-up: edit the subject and message then “Save”, or “Rewrite” with Shorter, More direct, Suggest a call, Different angle, or your own instruction. Then “Approve” (it goes out at the scheduled time, prospect's time zone) or “Send now”.",
      },
      {
        id: "envoyer-moi-meme",
        q: "Can I send the follow-up from my own inbox?",
        a: "Yes: “Copy” or “Open in my email app”, send it, then click “I sent it myself” so Clozer knows.",
      },
      {
        id: "adresse-envoi",
        q: "Which address do follow-ups come from?",
        a: "From Clozer's address, with your email as the reply-to: the prospect's replies land in your inbox. An unsubscribe link is added to every send.",
      },
      {
        id: "reponses",
        q: "Does Clozer see my prospects' replies?",
        a: "Not yet. Log them on the prospect's page (Log an interaction → Reply received): Clozer adjusts what comes next and won't follow up at the wrong moment.",
      },
      {
        id: "arreter",
        q: "How do I stop follow-ups?",
        a: "For the whole workspace: “Review everything myself” on Today, or switch back to “I review and approve”.\n\nFor one prospect: the “Follow-ups” toggle (document's Prospects tab), “Follow-ups prepared by Clozer” in the link settings, “Pause until”, or a status other than Open.\n\nFor new links: Settings → Advanced settings → Links and follow-ups → “Prepare follow-ups”.",
      },
      {
        id: "ton-signature",
        q: "How do I make follow-ups sound like me?",
        a: "Settings → Advanced settings → Links and follow-ups: “Signed by”, the tone (for example “direct, friendly, no jargon”) and your signature. Fill in your offer too (Offer and assistant): Clozer uses it to write.",
        link: { href: "/settings#messages", label: "Settings → Advanced settings → Links and follow-ups" },
      },
      {
        id: "whatsapp",
        q: "Can I follow up on WhatsApp?",
        a: "Not yet: WhatsApp follow-ups are coming soon. You can already record a contact's WhatsApp consent on the prospect's page.",
      },
    ],
  },
  {
    id: "assistant",
    title: "Prospect assistant",
    items: [
      {
        id: "assistant-quoi",
        q: "What is the prospect assistant?",
        a: "On your document, it answers the prospect's questions when you're not around. It relies on the document, your offer, the document's “Info for the assistant” and “What the assistant should know” (Settings → Advanced settings → Offer and assistant). It never makes up a price or a term.",
      },
      {
        id: "assistant-ne-sait-pas",
        q: "What happens when it can't answer?",
        a: "It passes the question to you right away: “Prospect question” alert, question flagged on the prospect's page and included in the morning digest.",
      },
      {
        id: "assistant-nourrir",
        q: "How do I make it more useful?",
        a: "Add your terms, guarantees and common questions in Settings → Advanced settings → Offer and assistant (for all documents) or in “Info for the assistant” on a document's page. Then read the questions asked: they reveal the objections.\n\nHeads up: anything you write for the assistant can be pulled out by the prospect. Nothing confidential.",
        link: { href: "/settings#assistant", label: "Settings → Advanced settings → Offer and assistant" },
      },
      {
        id: "assistant-activer",
        q: "How do I turn it on or off?",
        a: "“Turn on the assistant for new links” in Settings → Advanced settings → Offer and assistant, then link by link with “Ask the assistant” in the link settings.",
      },
      {
        id: "assistant-conversations",
        q: "Where do I see the questions the prospect asked?",
        a: "On the prospect's page, “Prospect questions” section. Your own tests on your link don't count.",
      },
    ],
  },
  {
    id: "accueil",
    title: "Welcome message and voice notes",
    items: [
      {
        id: "mot-accueil",
        q: "How do I add a video welcome message?",
        a: "Document page → The document tab → Welcome message: a video or audio only, up to 90 seconds, with an optional hook line. The prospect sees your bubble as soon as they open it, on every page and on every link of this document.",
      },
      {
        id: "mot-accueil-perso",
        q: "Can I personalize the welcome message for one prospect?",
        a: "Yes: prospect's page → Welcome message → “Personal version for this prospect”. It replaces the document's version for this prospect.",
      },
      {
        id: "vocaux",
        q: "Can the prospect leave me a voice message?",
        a: "Yes, on a page of a PDF (60 seconds max). You get the audio and its transcript, on the prospect's page (Voice comments) and through an alert. Turn it on in Settings → Advanced settings → Links and follow-ups, or link by link with “Leave a voice note on a page”.",
      },
      {
        id: "capsules",
        q: "What are page capsules?",
        a: "Older explanations recorded page by page. Existing ones still play on their page; for a new message, use the welcome message.",
      },
    ],
  },
  {
    id: "outils",
    title: "Chrome extension and Outlook",
    items: [
      {
        id: "outil-pourquoi",
        q: "What are the extension and the Outlook add-in for?",
        a: "You attach a PDF in Gmail or Outlook as usual: Clozer swaps it for a tracked link, with the first recipient as the prospect. The “C” button in the email also lets you pick an existing document.",
        link: { href: "/settings#extension", label: "Settings → Chrome and Outlook" },
      },
      {
        id: "chrome",
        q: "How do I install the Chrome extension?",
        a: "It works with Gmail and Outlook in the browser, on Chrome or Edge. Install it, pin it (puzzle icon), click Clozer then “Connect”; on the page that opens, sign in if needed and click “Connect the extension”.",
      },
      {
        id: "outlook",
        q: "How do I install the Outlook add-in (Windows or Mac)?",
        a: "Download the manifest file (link in Settings → Chrome and Outlook or in the onboarding), then in Outlook: Add-ins → My add-ins → Add from file. In a new email, click “Clozer” in the ribbon: a code shows up; enter it on the “Connect Outlook” page.\n\nYour IT team can also deploy it for the whole team from the Microsoft 365 admin center.",
      },
      {
        id: "autre-messagerie",
        q: "I use a different email app. What do I do?",
        a: "Upload the PDF to Clozer, then copy the link or use “Send by email”.",
      },
      {
        id: "drive",
        q: "Are Drive or OneDrive attachments supported?",
        a: "Not yet, and neither are forwarded attachments. Use the “C” button in the email or upload the PDF to Clozer.",
      },
      {
        id: "deconnecter-outil",
        q: "How do I disconnect the extension or Outlook?",
        a: "Settings → Chrome and Outlook: one Chrome card, one Outlook card, each with its connections and a “Revoke” button (you're asked to confirm).",
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    items: [
      {
        id: "etre-prevenu",
        q: "How do I choose when I get notified?",
        a: "Settings → Notifications. These settings only apply to you:\n- an email as soon as a prospect approves, requests changes or books a meeting;\n- “When it's time to call”: Chrome extension notification and, if you want, an email too;\n- a digest every morning, at a time you pick between 6 and 10 a.m.",
        link: { href: "/settings#alertes", label: "Settings → Notifications" },
      },
      {
        id: "moment-appeler",
        q: "What is the “time to call” alert?",
        a: "Clozer alerts you on the first open, on a return after a quiet spell, on a long pricing read or when several people read at once. Never in the evening or on weekends, 4 per hour at most. Call right then: what counts is during or right after the read.",
      },
      {
        id: "compte-rendu",
        q: "What's in the morning digest?",
        a: "Who to get back to today and why, then yesterday's replies and reads. Monday to Friday, and nothing if there's nothing to say.",
      },
      {
        id: "soir-weekend",
        q: "Will I get alerts in the evening or on weekends?",
        a: "Only for things that need action: approval, change request, meeting, question to the assistant, voice note, extension request. “Time to call” alerts never go out in the evening or on weekends.",
      },
      {
        id: "slack",
        q: "How do I get notified in Slack or my CRM?",
        a: "Settings → Advanced settings → Integrations (owners and admins): “Connect Slack or an external tool” with the Slack webhook URL, or a webhook (CRM, Zapier, Make…) signed with HMAC SHA-256, header X-Closing-Signature. Then choose to notify the whole team in Slack and/or the external tool.",
        link: { href: "/settings#integrations", label: "Settings → Advanced settings → Integrations" },
      },
      {
        id: "agenda",
        q: "How do I offer the prospect a meeting?",
        a: "Settings → Your calendar: paste your booking link. Calendly and Cal.com show up inside the prospect's page (name and email prefilled); others (HubSpot, Google Calendar…) open in a tab. No link, no “Book a meeting” button. A different link can be set link by link.",
        link: { href: "/settings#agenda", label: "Settings → Your calendar" },
      },
    ],
  },
  {
    id: "equipe",
    title: "Team and roles",
    items: [
      {
        id: "roles",
        q: "What are the roles and what can each one do?",
        a: "- Member: sees their own prospects on Today, views coworkers' prospects without editing them, sets their own notifications and calendar.\n- Admin: sees the whole team on the Team page, configures the workspace, edits every prospect, deletes documents, invites and removes members.\n- Owner: same as an admin, plus links without an assigned sales rep, the ability to make someone else owner and to delete the workspace.",
      },
      {
        id: "inviter",
        q: "How do I invite a coworker?",
        a: "Settings → Advanced settings → Team (or “Invite a sales rep” on the Team page): email + role (Member or Admin), then “Invite”. Owners and admins only.",
        link: { href: "/settings#equipe", label: "Settings → Advanced settings → Team" },
      },
      {
        id: "role-retirer",
        q: "How do I change a role or remove someone?",
        a: "Settings → Advanced settings → Team: change the role, “Remove” a member or cancel a pending invitation.",
      },
      {
        id: "vue-equipe",
        q: "How do I read the team view?",
        a: "Team page (owners and admins), visible as soon as a second member joins the workspace: the Open, Moving, Slipping, To close out and Pipeline figures, a “By sales rep” table (click to filter) and three columns: Moving (watch closely), Slipping (cooling down), To close out (one last follow-up, or close it). The temperature (Hot, Warm, Cold) stays the same as on Today.",
      },
      {
        id: "reglages-grises",
        q: "Why are some settings grayed out?",
        a: "Workspace settings are reserved for owners and admins. Members don't see them: they only get Chrome and Outlook, Notifications, Your calendar and Data.",
      },
    ],
  },
  {
    id: "donnees",
    title: "Data and privacy",
    items: [
      {
        id: "prospect-informe",
        q: "Does the prospect know their reading is tracked?",
        a: "Yes. A clear notice appears on the document page, with a link to the privacy policy. Follow-ups, on the other hand, never mention a page or a reading time.",
      },
      {
        id: "ia-donnees",
        q: "What data is sent to the AI?",
        a: "Document content and reading facts. No email address and no IP address: readers are shown by a letter (reader A, reader B…).",
      },
      {
        id: "conservation",
        q: "How long is data kept?",
        a: "Read tracking is erased 12 months after a link's last activity. A deleted document is permanently erased after 30 days.",
      },
      {
        id: "demande-prospect",
        q: "A prospect asks for their data or for it to be deleted. What do I do?",
        a: "Settings → Data (owners and admins): look up their email, then “Export” or “Delete everything” (reads, messages, voice notes, follow-ups). Signed approvals are kept 5 years as proof of the agreement. Reply within a month.",
        link: { href: "/settings#donnees", label: "Settings → Data" },
      },
      {
        id: "exporter",
        q: "Can I export my workspace data?",
        a: "Yes: “Export workspace” in Settings → Data (owners and admins): links, prospects, reads and messages as JSON.",
      },
      {
        id: "supprimer-compte",
        q: "How do I delete my account or the workspace?",
        a: "Settings → Data:\n- “Delete my account” (type DELETE): your prospects stay in the workspace, your access goes away;\n- “Delete workspace” (owner, type the workspace name): everything is erased, files included, for the whole team. This can't be undone: export first.",
      },
    ],
  },
  {
    id: "reglages",
    title: "Settings and offer",
    items: [
      {
        id: "votre-offre",
        q: "What is “Your offer” for?",
        a: "What you sell, your customers, why they pick you, common objections and the usual length of a sale. Clozer uses it to analyze and write. It's optional: Clozer prefills it when it reads your first document. Remember to click “Save settings”.",
        link: { href: "/settings#offre", label: "Settings → Advanced settings → Offer and assistant" },
      },
      {
        id: "vos-liens",
        q: "How do I change the default settings for new links?",
        a: "Settings → Advanced settings → Links and follow-ups: expiration for quotes and proposals, voice notes, prepare follow-ups. Each link can still be changed afterward.",
        link: { href: "/settings#liens", label: "Settings → Advanced settings → Links and follow-ups" },
      },
      {
        id: "theme",
        q: "How do I switch to dark mode?",
        a: "Account menu (your avatar at the top right): theme picker.",
      },
      {
        id: "prix",
        q: "How much does Clozer cost?",
        a: "Clozer is free during the beta.",
      },
    ],
  },
  {
    id: "aide",
    title: "Help and suggestions",
    items: [
      {
        id: "assistant-aide",
        q: "How do I ask a question that isn't here?",
        a: "Open the help assistant: “?” button at the top right → “Ask a question”, or Cmd+K. It answers right away and, if needed, passes your question on to the team.",
      },
      {
        id: "suggestion",
        q: "How do I suggest an idea or report a bug?",
        a: "Tell the help assistant. It asks for your OK, then passes it on to the Clozer team, who read everything and can reply by email.",
      },
    ],
  },
];
