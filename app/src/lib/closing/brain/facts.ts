import { createHash } from "node:crypto";

import type { DocumentKind, PageTag, ProspectActionType, ViewSignalType } from "@/generated/prisma/enums";
import type { UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator, type ServerT } from "@/lib/server-translator";

import { DAY_MS } from "../constants";
import { tagLabels } from "../documents/doc-types";
import { tagNames } from "../documents/doc-type-names";
import { reachedLabel, segmentLabel } from "../documents/video-segments";
import { untrusted } from "../ai/prompts";

/**
 * Turns everything known about a deal into numbered, dated facts the model
 * must cite (F1…Fn). Pure: `now` is passed in, nothing is read from the
 * database. What the model sees is exactly `story.facts`, so every claim
 * it makes can be traced back to a line here.
 *
 * Privacy: no email, IP or city ever goes in. Readers are letters.
 */

const HOUR_MS = 60 * 60 * 1000;
/** Silent reading speed used to say whether a page got more time than reading it takes. */
const WORDS_PER_MINUTE = 230;
const MIN_EXPECTED_PAGE_MS = 5_000;
/** A page read less than this is a page turned, not read. */
const NOTABLE_PAGE_MS = 15_000;
const PAGES_PER_SESSION_FACT = 4;
/** Older sessions are folded into one line to keep the prompt short. */
const MAX_SESSION_FACTS = 25;
const REVISIT_GAP_MS = DAY_MS;
const REOPEN_AFTER_FOLLOWUP_MS = 3 * DAY_MS;
/** Silence steps that warrant a fresh look even when nothing happened. */
export const QUIET_BUCKETS = [0, 1, 3, 7, 14, 30] as const;

/** Default section names; buildDealStory adapts them to the document type. */
export const TAG_NAMES: Record<PageTag, string> = tagLabels(null);

export type DealFactsInput = {
  now: Date;
  /** The seller's language: the facts are shown to them next to the analysis. */
  locale: UiLocale;
  /** Seller-side time zone, used when a session has none. */
  defaultTimezone: string;
  businessHours: { start: number; end: number; days: number[] };
  deal: {
    sentAt: Date | null;
    createdAt: Date;
    dealStatus: "OPEN" | "VALIDATED" | "CHANGE_REQUESTED" | "WON" | "LOST";
    dealAmountCents: number | null;
    dealCurrency: string | null;
    decisionDeadline: Date | null;
    /** Set by the seller: after it the link no longer opens. */
    expiresAt?: Date | null;
  };
  document: {
    name: string;
    kind: DocumentKind;
    /** VIDEO: its length, each page being a tenth of it. */
    durationMs?: number | null;
    /** An embedded YouTube or Vimeo video: completion is the share watched. */
    embeddedVideo?: boolean;
    /** QUOTE, RESUME…: section names follow it ("TJM" rather than "Tarifs" on a résumé). */
    docType?: string | null;
    pages: { pageNumber: number; tags: PageTag[]; summary: string | null; wordCount: number }[];
  };
  /** Contacts on the link, the main one first. Names only, never emails. */
  prospects: { id: string; name: string | null; company: string | null }[];
  views: {
    id: string;
    visitorId: string;
    prospectId: string | null;
    startedAt: Date;
    lastSeenAt: Date;
    totalDurationMs: number;
    deviceType: string | null;
    country: string | null;
    timezone: string | null;
    maxPageReached: number;
    pages: { pageNumber: number; totalDurationMs: number }[];
    /** Web pages: share of the video watched, or of the article read in Clozer. */
    depth?: number | null;
    /** What the reader did around the content (tracking/view-signals.ts). */
    signals?: { type: ViewSignalType; valueMs: number | null }[];
  }[];
  actions: {
    type: ProspectActionType;
    message: string | null;
    createdAt: Date;
    prospectId: string | null;
  }[];
  followups: {
    sentAt: Date;
    channel: "EMAIL" | "WHATSAPP";
    subject: string | null;
    sentVia: "PLATFORM" | "MANUAL" | "MAILBOX" | null;
    /** What the message did: reopened from its link, answered, or bounced. */
    clickedAt?: Date | null;
    repliedAt?: Date | null;
    bouncedAt?: Date | null;
  }[];
  sellerActivities: {
    type: "CALL" | "EMAIL_REPLY_RECEIVED" | "MEETING" | "NOTE" | "MANUAL_SEND";
    note: string | null;
    occurredAt: Date;
    /** INBOUND, EXTENSION and MAILBOX: caught by Clozer, the note is the prospect's own words. */
    source?: "MANUAL" | "INBOUND" | "EXTENSION" | "MAILBOX";
  }[];
  score: { score: number; tier: "HOT" | "WARM" | "COLD" } | null;
};

export type FactKind =
  | "SENT"
  | "SESSION"
  | "OLDER_SESSIONS"
  | "PROSPECT_ACTION"
  | "FOLLOWUP_SENT"
  | "SELLER_ACTIVITY"
  | "SECTION_ATTENTION"
  | "DROP_OFF"
  | "READERS"
  | "OFF_HOURS"
  | "QUIET"
  | "DEADLINE"
  | "SCORE";

export type Fact = { id: string; kind: FactKind; at: Date | null; text: string };

export type Reader = {
  /** "A", "B"… in order of first reading. */
  label: string;
  prospectId: string | null;
  description: string;
};

export type DealStory = {
  facts: Fact[];
  readers: Reader[];
  /** First contact on the link: who gets written to when no reader is named. */
  mainProspectId: string | null;
  opened: boolean;
  quietDays: number | null;
  /** True when the prospect wrote something (change request message). */
  hasProspectText: boolean;
  inputHash: string;
};

/** "3 min 08" / "3m 08s" */
const fmtDuration = (ms: number, locale: UiLocale) => {
  const s = Math.round(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (locale === "en") {
    if (s < 60) return `${s}s`;
    if (m < 60) return rest ? `${m}m ${pad(rest)}s` : `${m} min`;
    return `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
  }
  if (s < 60) return `${s} s`;
  if (m < 60) return rest ? `${m} min ${pad(rest)}` : `${m} min`;
  return `${Math.floor(m / 60)} h ${pad(m % 60)}`;
};

function localParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const weekday = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(get("weekday")) + 1;
  return { weekday, hour: Number(get("hour")), label: `${get("hour")}:${get("minute")}` };
}

const WEEKDAYS: Record<UiLocale, string[]> = {
  fr: ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

function safeZone(zone: string | null, fallback: string) {
  if (!zone) return fallback;
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: zone });
    return zone;
  } catch {
    return fallback;
  }
}

function expectedReadMs(wordCount: number) {
  return Math.max(MIN_EXPECTED_PAGE_MS, (wordCount / WORDS_PER_MINUTE) * 60_000);
}

function pageRanges(numbers: number[]) {
  const sorted = [...numbers].sort((a, b) => a - b);
  const ranges: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    ranges.push(i === j ? `p.${sorted[i]}` : `p.${sorted[i]}-${sorted[j]}`);
    i = j;
  }
  return ranges.join(", ");
}

export function quietBucket(days: number | null) {
  if (days === null) return -1;
  return [...QUIET_BUCKETS].reverse().find((step) => days >= step) ?? 0;
}

function deadlineBucket(daysLeft: number | null) {
  if (daysLeft === null) return "none";
  if (daysLeft < 0) return "past";
  if (daysLeft <= 3) return "3d";
  if (daysLeft <= 7) return "7d";
  if (daysLeft <= 14) return "14d";
  return "later";
}

type FactsT = ServerT<"server.facts">;

/** What a session's signals add to its line, in the analysis' words. */
function signalNotes(signals: { type: ViewSignalType; valueMs: number | null }[], t: FactsT, locale: UiLocale) {
  const notes: string[] = [];
  if (signals.some((s) => s.type === "EXTERNAL_OPEN")) {
    const awayMs = signals.reduce((sum, s) => sum + (s.type === "EXTERNAL_RETURN" ? (s.valueMs ?? 0) : 0), 0);
    notes.push(awayMs > 0 ? t("externalAway", { duration: fmtDuration(awayMs, locale) }) : t("external"));
  }
  if (signals.some((s) => s.type === "DOWNLOAD")) notes.push(t("download"));
  const copied = signals.filter((s) => s.type === "COPY_TEXT");
  if (copied.length > 0) notes.push(t("copied", { count: copied.length }));
  if (signals.some((s) => s.type === "PRINT")) notes.push(t("printed"));
  if (signals.some((s) => s.type === "EXIT_PROMPT_OPENED")) notes.push(t("exitPrompt"));
  return notes;
}

export function buildDealStory(input: DealFactsInput): DealStory {
  const { now, deal, document, locale } = input;
  const t = getNamespaceTranslator(locale, "server.facts");
  const duration = (ms: number) => fmtDuration(ms, locale);
  const origin = deal.sentAt ?? deal.createdAt;
  const dayOf = (date: Date) => t("day", { days: String(Math.max(0, Math.floor((date.getTime() - origin.getTime()) / DAY_MS))) });
  const pageByNumber = new Map(document.pages.map((page) => [page.pageNumber, page]));
  const sectionNames = tagNames(document.docType, locale);
  const numPages = document.kind !== "URL" ? document.pages.length : 0;
  // A video pitch: page N is its Nth tenth, watched rather than read
  const video = document.kind === "VIDEO";
  const pageName = (n: number) => (video ? t("videoPart", { segment: segmentLabel(n, undefined, locale) }) : `p.${n}`);
  const expectedMs = (wordCount: number) =>
    video && document.durationMs && numPages ? document.durationMs / numPages : expectedReadMs(wordCount);
  const sentAs = video
    ? t("sentAsVideo", { duration: duration(document.durationMs ?? 0) })
    : numPages
      ? t("sentAsPages", { count: numPages })
      : t("sentAsWeb");
  const mainProspectId = input.prospects[0]?.id ?? null;

  // Readers: one per known contact, else one per browser
  const views = [...input.views].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const readerKey = (view: (typeof views)[number]) => view.prospectId ?? `visitor:${view.visitorId}`;
  const readers = new Map<string, Reader>();
  for (const view of views) {
    const key = readerKey(view);
    if (readers.has(key)) continue;
    const label = String.fromCharCode(65 + Math.min(readers.size, 25));
    const prospect = input.prospects.find((p) => p.id === view.prospectId);
    const firstName = prospect?.name?.trim().split(/\s+/)[0];
    const description = prospect
      ? `${firstName ?? t("unnamedContact")}, ${prospect.id === mainProspectId ? t("mainContact") : t("otherContact")}`
      : [t("unidentifiedReader"), view.deviceType, view.country].filter(Boolean).join(", ");
    readers.set(key, { label, prospectId: prospect?.id ?? null, description });
  }

  type Draft = Omit<Fact, "id"> & { hashed: boolean };
  const timeline: Draft[] = [];

  timeline.push({
    kind: "SENT",
    at: origin,
    text: `[${t("day", { days: "0" })}] ${t("sent", { name: document.name, sentAs })}`,
    hashed: true,
  });

  // Sessions
  const sessionDrafts: Draft[] = [];
  let previousEnd: Date | null = null;
  const seenReaders = new Set<string>();
  for (const view of views) {
    const zone = safeZone(view.timezone, input.defaultTimezone);
    const local = localParts(view.startedAt, zone);
    const reader = readers.get(readerKey(view))!;
    const notes: string[] = [];

    if (!seenReaders.has(reader.label)) {
      seenReaders.add(reader.label);
      if (seenReaders.size > 1) notes.push(t("firstVisit"));
    }
    if (previousEnd && view.startedAt.getTime() - previousEnd.getTime() >= REVISIT_GAP_MS) {
      notes.push(t("backAfter", { days: Math.floor((view.startedAt.getTime() - previousEnd.getTime()) / DAY_MS) }));
    }
    const followupBefore = input.followups
      .filter((f) => f.sentAt <= view.startedAt && view.startedAt.getTime() - f.sentAt.getTime() <= REOPEN_AFTER_FOLLOWUP_MS)
      .at(-1);
    if (followupBefore) {
      notes.push(
        t("openedAfterFollowup", {
          duration: duration(view.startedAt.getTime() - followupBefore.sentAt.getTime()),
          day: dayOf(followupBefore.sentAt),
        }),
      );
    }

    const notable = view.pages
      .filter((p) => p.totalDurationMs >= NOTABLE_PAGE_MS)
      .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
      .slice(0, PAGES_PER_SESSION_FACT)
      .map((p) => {
        const page = pageByNumber.get(p.pageNumber);
        const tag = page?.tags.find((t) => t !== "OTHER");
        const ratio = page ? p.totalDurationMs / expectedMs(page.wordCount) : 0;
        const ratioText =
          ratio >= 1.8 ? ` ${t("ratio", { ratio: String(Math.round(ratio)), basis: video ? t("basisWatch") : t("basisRead") })}` : "";
        return `${tag ? `${sectionNames[tag]} ` : ""}${pageName(p.pageNumber)} ${duration(p.totalDurationMs)}${ratioText}`;
      });

    const parts = [
      t("sessionHeader", {
        day: dayOf(view.startedAt),
        weekday: WEEKDAYS[locale][local.weekday - 1],
        time: local.label,
        device: view.deviceType ?? t("unknownDevice"),
        label: reader.label,
      }),
      video ? t("watchTime", { duration: duration(view.totalDurationMs) }) : t("readTime", { duration: duration(view.totalDurationMs) }),
      video
        ? t("watched", { reached: reachedLabel(view.maxPageReached, numPages, locale) })
        : numPages
          ? t("upToPage", { page: view.maxPageReached, count: numPages })
          : null,
      document.embeddedVideo
        ? t("videoWatched", { percent: Math.round((view.depth ?? 0) * 100) })
        : view.depth
          ? t("articleRead", { percent: Math.round(view.depth * 100) })
          : null,
      numPages && notable.length ? t("mostly", { pages: notable.join(", ") }) : null,
      ...signalNotes(view.signals ?? [], t, locale),
      notes.length ? notes.join(", ") : null,
    ].filter(Boolean);

    sessionDrafts.push({ kind: "SESSION", at: view.startedAt, text: parts.join(t("sep")), hashed: true });
    previousEnd = view.lastSeenAt;
  }
  if (sessionDrafts.length > MAX_SESSION_FACTS) {
    const older = sessionDrafts.splice(0, sessionDrafts.length - MAX_SESSION_FACTS);
    const olderViews = views.slice(0, older.length);
    timeline.push({
      kind: "OLDER_SESSIONS",
      at: older[0].at,
      text: t("olderSessions", {
        count: older.length,
        from: dayOf(olderViews[0].startedAt),
        to: dayOf(olderViews.at(-1)!.startedAt),
        duration: duration(olderViews.reduce((s, v) => s + v.totalDurationMs, 0)),
      }),
      hashed: true,
    });
  }
  timeline.push(...sessionDrafts);

  for (const action of input.actions) {
    const reader = [...readers.values()].find((r) => r.prospectId && r.prospectId === action.prospectId);
    const who = reader ? t("reader", { label: reader.label }) : t("theProspect");
    const what = t(
      `action.${
        (["VALIDATE_SIGN", "REQUEST_EXTENSION", "REQUEST_RELINK", "MEETING_BOOKED", "MEETING_CLICK", "REQUEST_QUOTE"] as const).find(
          (type) => type === action.type,
        ) ?? "REQUEST_CHANGE"
      }`,
    );
    const message = action.message
      ? `${t("colon")}<untrusted_prospect_message>${untrusted(action.message.slice(0, 600))}</untrusted_prospect_message>`
      : "";
    timeline.push({ kind: "PROSPECT_ACTION", at: action.createdAt, text: `[${dayOf(action.createdAt)}] ${who} ${what}${message}`, hashed: true });
  }

  for (const followup of input.followups) {
    const how = followup.sentVia === "MANUAL" ? t("followupByHand") : t("followupByClozer");
    const channel = followup.channel === "EMAIL" ? (locale === "en" ? "Email" : "email") : "WhatsApp";
    timeline.push({
      kind: "FOLLOWUP_SENT",
      at: followup.sentAt,
      text: `[${dayOf(followup.sentAt)}] ${t("followup", {
        channel,
        how,
        subject: followup.subject ? t("followupSubject", { subject: followup.subject.slice(0, 120) }) : "",
      })}${followup.bouncedAt ? t("followupBounced") : followup.repliedAt ? t("followupReplied") : followup.clickedAt ? t("followupClicked") : ""}`,
      hashed: true,
    });
  }

  for (const activity of input.sellerActivities) {
    timeline.push({
      kind: "SELLER_ACTIVITY",
      at: activity.occurredAt,
      text: `[${dayOf(activity.occurredAt)}] ${t(`activity.${activity.type}`)}${
        !activity.note
          ? ""
          : activity.source && activity.source !== "MANUAL"
            ? `${t("colon")}<untrusted_prospect_message>${untrusted(activity.note.slice(0, 600))}</untrusted_prospect_message>`
            : `${t("colon")}${activity.note.slice(0, 400)}`
      }`,
      hashed: true,
    });
  }

  timeline.sort((a, b) => (a.at?.getTime() ?? 0) - (b.at?.getTime() ?? 0));

  // Whole-deal facts
  const summary: Draft[] = [];
  const opened = views.length > 0;

  if (numPages && opened) {
    const totals = new Map<number, number>();
    for (const view of views) {
      for (const page of view.pages) totals.set(page.pageNumber, (totals.get(page.pageNumber) ?? 0) + page.totalDurationMs);
    }
    const byTag = new Map<PageTag, { pages: number[]; ms: number; expected: number }>();
    for (const page of document.pages) {
      for (const tag of page.tags) {
        if (tag === "OTHER") continue;
        const entry = byTag.get(tag) ?? { pages: [], ms: 0, expected: 0 };
        entry.pages.push(page.pageNumber);
        entry.ms += totals.get(page.pageNumber) ?? 0;
        entry.expected += expectedMs(page.wordCount);
        byTag.set(tag, entry);
      }
    }
    for (const [tag, entry] of byTag) {
      const ratio = entry.ms / entry.expected;
      summary.push({
        kind: "SECTION_ATTENTION",
        at: null,
        text: t("section", {
          section: sectionNames[tag],
          pages: video ? entry.pages.map((n) => segmentLabel(n, numPages, locale)).join(", ") : pageRanges(entry.pages),
          detail: entry.ms
            ? t("sectionTime", {
                duration: duration(entry.ms),
                ratio: String(ratio < 1 ? ratio.toFixed(1) : Math.round(ratio)),
                basis: video ? t("basisWatch") : t("basisReadOnce"),
              })
            : video
              ? t("neverWatched")
              : t("neverRead"),
        }),
        hashed: true,
      });
    }

    const furthest = Math.max(...views.map((v) => v.maxPageReached));
    if (furthest < numPages) {
      const page = pageByNumber.get(furthest);
      summary.push({
        kind: "DROP_OFF",
        at: null,
        text: `${
          video
            ? t("dropOffVideo", { reached: reachedLabel(furthest, numPages, locale) })
            : t("dropOffPages", { page: furthest, count: numPages })
        }${page?.summary ? ` (${page.summary})` : ""}`,
        hashed: true,
      });
    }
  }

  if (readers.size > 0) {
    summary.push({
      kind: "READERS",
      at: null,
      text: t("readers", {
        count: readers.size,
        list: [...readers.values()].map((r) => `${r.label} (${r.description})`).join(t("sep")),
      }),
      hashed: true,
    });
  }

  if (opened) {
    let offMs = 0;
    let totalMs = 0;
    for (const view of views) {
      const local = localParts(view.startedAt, safeZone(view.timezone, input.defaultTimezone));
      const inHours =
        input.businessHours.days.includes(local.weekday) &&
        local.hour >= input.businessHours.start &&
        local.hour < input.businessHours.end;
      totalMs += view.totalDurationMs;
      if (!inHours) offMs += view.totalDurationMs;
    }
    if (totalMs > 0 && offMs / totalMs >= 0.3) {
      summary.push({
        kind: "OFF_HOURS",
        at: null,
        text: t("offHours", { percent: Math.round((offMs / totalMs) * 100) }),
        hashed: true,
      });
    }
  }

  // Facts that move with the clock: left out of the hash, their bucket goes in instead
  const lastReading = views.length ? new Date(Math.max(...views.map((v) => v.lastSeenAt.getTime()))) : null;
  const quietDays = lastReading ? Math.floor((now.getTime() - lastReading.getTime()) / DAY_MS) : null;
  const sinceSent = Math.floor((now.getTime() - origin.getTime()) / DAY_MS);
  summary.push({
    kind: "QUIET",
    at: null,
    text:
      quietDays === null
        ? t("neverOpened", { sent: sinceSent })
        : quietDays === 0
          ? t("lastReadHours", { hours: Math.max(1, Math.round((now.getTime() - lastReading!.getTime()) / HOUR_MS)), sent: sinceSent })
          : t("quietDays", { days: quietDays, sent: sinceSent }),
    hashed: false,
  });

  const daysLeft = deal.decisionDeadline
    ? Math.ceil((deal.decisionDeadline.getTime() - now.getTime()) / DAY_MS)
    : null;
  if (daysLeft !== null) {
    summary.push({
      kind: "DEADLINE",
      at: null,
      text: daysLeft >= 0 ? t("decisionIn", { days: daysLeft }) : t("decisionPast", { days: -daysLeft }),
      hashed: false,
    });
  }

  const expiryDaysLeft = deal.expiresAt ? Math.ceil((deal.expiresAt.getTime() - now.getTime()) / DAY_MS) : null;
  if (expiryDaysLeft !== null) {
    summary.push({
      kind: "DEADLINE",
      at: null,
      text:
        expiryDaysLeft > 0 ? t("expiresIn", { days: expiryDaysLeft }) : t("expiredSince", { days: -expiryDaysLeft }),
      hashed: false,
    });
  }

  if (input.score && opened) {
    summary.push({
      kind: "SCORE",
      at: null,
      text: t("score", { score: input.score.score, tier: t(`tier.${input.score.tier}`) }),
      hashed: false,
    });
  }

  const drafts = [...timeline, ...summary];
  const facts: Fact[] = drafts.map((draft, index) => ({
    id: `F${index + 1}`,
    kind: draft.kind,
    at: draft.at,
    text: draft.text,
  }));

  const hash = createHash("sha256");
  for (const draft of drafts) if (draft.hashed) hash.update(`${draft.kind}|${draft.text}\n`);
  hash.update(
    JSON.stringify({
      status: deal.dealStatus,
      amount: deal.dealAmountCents,
      currency: deal.dealCurrency,
      quiet: quietBucket(quietDays),
      deadline: deadlineBucket(daysLeft),
      expiry: deadlineBucket(expiryDaysLeft),
    }),
  );

  return {
    facts,
    readers: [...readers.values()],
    mainProspectId,
    opened,
    quietDays,
    hasProspectText: input.actions.some((a) => a.message),
    inputHash: hash.digest("hex"),
  };
}

export function renderFacts(facts: Fact[]) {
  return facts.map((fact) => `${fact.id} ${fact.text}`).join("\n");
}
