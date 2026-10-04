import { createHash } from "node:crypto";

import type { PageTag } from "@/generated/prisma/enums";

import { DAY_MS } from "../constants";
import { tagLabels } from "../documents/doc-types";

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
  };
  document: {
    name: string;
    kind: "FILE" | "URL";
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
  }[];
  actions: {
    type: "VALIDATE_SIGN" | "REQUEST_CHANGE";
    message: string | null;
    createdAt: Date;
    prospectId: string | null;
  }[];
  followups: {
    sentAt: Date;
    channel: "EMAIL" | "WHATSAPP";
    subject: string | null;
    sentVia: "PLATFORM" | "MANUAL" | null;
  }[];
  sellerActivities: {
    type: "CALL" | "EMAIL_REPLY_RECEIVED" | "MEETING" | "NOTE" | "MANUAL_SEND";
    note: string | null;
    occurredAt: Date;
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

const fmtDuration = (ms: number) => {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s} s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m < 60) return rest ? `${m} min ${String(rest).padStart(2, "0")}` : `${m} min`;
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
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

const FR_WEEKDAYS = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."];

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

const SELLER_ACTIVITY_TEXT: Record<DealFactsInput["sellerActivities"][number]["type"], string> = {
  CALL: "Appel avec le prospect",
  EMAIL_REPLY_RECEIVED: "Réponse du prospect reçue par email",
  MEETING: "Rendez-vous avec le prospect",
  NOTE: "Note du vendeur",
  MANUAL_SEND: "Message envoyé par le vendeur",
};

export function buildDealStory(input: DealFactsInput): DealStory {
  const { now, deal, document } = input;
  const origin = deal.sentAt ?? deal.createdAt;
  const dayOf = (date: Date) => `J+${Math.max(0, Math.floor((date.getTime() - origin.getTime()) / DAY_MS))}`;
  const pageByNumber = new Map(document.pages.map((page) => [page.pageNumber, page]));
  const sectionNames = tagLabels(document.docType);
  const numPages = document.kind === "FILE" ? document.pages.length : 0;
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
      ? `${firstName ?? "contact sans nom"}, ${prospect.id === mainProspectId ? "contact principal" : "autre contact enregistré"}`
      : ["lecteur non identifié", view.deviceType, view.country].filter(Boolean).join(", ");
    readers.set(key, { label, prospectId: prospect?.id ?? null, description });
  }

  type Draft = Omit<Fact, "id"> & { hashed: boolean };
  const timeline: Draft[] = [];

  timeline.push({
    kind: "SENT",
    at: origin,
    text: `[J+0] Proposition « ${document.name} » envoyée${numPages ? ` (${numPages} pages)` : " (page web)"}`,
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
      if (seenReaders.size > 1) notes.push("premier passage de ce lecteur");
    }
    if (previousEnd && view.startedAt.getTime() - previousEnd.getTime() >= REVISIT_GAP_MS) {
      notes.push(`retour après ${Math.floor((view.startedAt.getTime() - previousEnd.getTime()) / DAY_MS)} j sans lecture`);
    }
    const followupBefore = input.followups
      .filter((f) => f.sentAt <= view.startedAt && view.startedAt.getTime() - f.sentAt.getTime() <= REOPEN_AFTER_FOLLOWUP_MS)
      .at(-1);
    if (followupBefore) {
      notes.push(`ouvert ${fmtDuration(view.startedAt.getTime() - followupBefore.sentAt.getTime())} après la relance du ${dayOf(followupBefore.sentAt)}`);
    }

    const notable = view.pages
      .filter((p) => p.totalDurationMs >= NOTABLE_PAGE_MS)
      .sort((a, b) => b.totalDurationMs - a.totalDurationMs)
      .slice(0, PAGES_PER_SESSION_FACT)
      .map((p) => {
        const page = pageByNumber.get(p.pageNumber);
        const tag = page?.tags.find((t) => t !== "OTHER");
        const ratio = page ? p.totalDurationMs / expectedReadMs(page.wordCount) : 0;
        const ratioText = ratio >= 1.8 ? ` (≈${Math.round(ratio)}× le temps de lecture)` : "";
        return `${tag ? `${sectionNames[tag]} ` : ""}p.${p.pageNumber} ${fmtDuration(p.totalDurationMs)}${ratioText}`;
      });

    const parts = [
      `[${dayOf(view.startedAt)} ${FR_WEEKDAYS[local.weekday - 1]} ${local.label} heure locale, ${view.deviceType ?? "appareil inconnu"}, Lecteur ${reader.label}]`,
      `${fmtDuration(view.totalDurationMs)} de lecture`,
      numPages ? `jusqu'à la p.${view.maxPageReached}/${numPages}` : null,
      notable.length ? `surtout : ${notable.join(", ")}` : null,
      notes.length ? notes.join(", ") : null,
    ].filter(Boolean);

    sessionDrafts.push({ kind: "SESSION", at: view.startedAt, text: parts.join(" ; "), hashed: true });
    previousEnd = view.lastSeenAt;
  }
  if (sessionDrafts.length > MAX_SESSION_FACTS) {
    const older = sessionDrafts.splice(0, sessionDrafts.length - MAX_SESSION_FACTS);
    const olderViews = views.slice(0, older.length);
    timeline.push({
      kind: "OLDER_SESSIONS",
      at: older[0].at,
      text: `${older.length} lectures plus anciennes entre ${dayOf(olderViews[0].startedAt)} et ${dayOf(olderViews.at(-1)!.startedAt)}, ${fmtDuration(olderViews.reduce((s, v) => s + v.totalDurationMs, 0))} au total`,
      hashed: true,
    });
  }
  timeline.push(...sessionDrafts);

  for (const action of input.actions) {
    const reader = [...readers.values()].find((r) => r.prospectId && r.prospectId === action.prospectId);
    const who = reader ? `Lecteur ${reader.label}` : "Le prospect";
    const what = action.type === "VALIDATE_SIGN" ? "a cliqué « Valider la proposition »" : "a demandé un ajustement";
    const message = action.message
      ? ` : <untrusted_prospect_message>${action.message.slice(0, 600)}</untrusted_prospect_message>`
      : "";
    timeline.push({ kind: "PROSPECT_ACTION", at: action.createdAt, text: `[${dayOf(action.createdAt)}] ${who} ${what}${message}`, hashed: true });
  }

  for (const followup of input.followups) {
    const how = followup.sentVia === "MANUAL" ? "envoyée par le vendeur lui-même" : "envoyée par Clozer";
    timeline.push({
      kind: "FOLLOWUP_SENT",
      at: followup.sentAt,
      text: `[${dayOf(followup.sentAt)}] Relance ${followup.channel === "EMAIL" ? "email" : "WhatsApp"} ${how}${followup.subject ? ` (objet : « ${followup.subject.slice(0, 120)} »)` : ""}`,
      hashed: true,
    });
  }

  for (const activity of input.sellerActivities) {
    timeline.push({
      kind: "SELLER_ACTIVITY",
      at: activity.occurredAt,
      text: `[${dayOf(activity.occurredAt)}] ${SELLER_ACTIVITY_TEXT[activity.type]}${activity.note ? ` : ${activity.note.slice(0, 400)}` : ""}`,
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
        entry.expected += expectedReadMs(page.wordCount);
        byTag.set(tag, entry);
      }
    }
    for (const [tag, entry] of byTag) {
      const ratio = entry.ms / entry.expected;
      summary.push({
        kind: "SECTION_ATTENTION",
        at: null,
        text: `${sectionNames[tag]} (${pageRanges(entry.pages)}) : ${entry.ms ? `${fmtDuration(entry.ms)} au total, ≈${ratio < 1 ? ratio.toFixed(1) : Math.round(ratio)}× le temps d'une lecture` : "jamais lu"}`,
        hashed: true,
      });
    }

    const furthest = Math.max(...views.map((v) => v.maxPageReached));
    if (furthest < numPages) {
      const page = pageByNumber.get(furthest);
      summary.push({
        kind: "DROP_OFF",
        at: null,
        text: `Personne n'est allé plus loin que la p.${furthest}/${numPages}${page?.summary ? ` (${page.summary})` : ""}`,
        hashed: true,
      });
    }
  }

  if (readers.size > 0) {
    summary.push({
      kind: "READERS",
      at: null,
      text: `${readers.size} lecteur${readers.size > 1 ? "s" : ""} : ${[...readers.values()].map((r) => `${r.label} (${r.description})`).join(" ; ")}`,
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
        text: `${Math.round((offMs / totalMs) * 100)} % du temps de lecture le soir ou le week-end (heure locale)`,
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
        ? `Jamais ouvert, envoyé il y a ${sinceSent} j`
        : quietDays === 0
          ? `Dernière lecture il y a ${Math.max(1, Math.round((now.getTime() - lastReading!.getTime()) / HOUR_MS))} h ; envoyé il y a ${sinceSent} j`
          : `Aucune lecture depuis ${quietDays} j ; envoyé il y a ${sinceSent} j`,
    hashed: false,
  });

  const daysLeft = deal.decisionDeadline
    ? Math.ceil((deal.decisionDeadline.getTime() - now.getTime()) / DAY_MS)
    : null;
  if (daysLeft !== null) {
    summary.push({
      kind: "DEADLINE",
      at: null,
      text: daysLeft >= 0 ? `Décision attendue dans ${daysLeft} j (selon le vendeur)` : `Date de décision dépassée de ${-daysLeft} j (selon le vendeur)`,
      hashed: false,
    });
  }

  if (input.score && opened) {
    const tier = { HOT: "chaud", WARM: "tiède", COLD: "froid" }[input.score.tier];
    summary.push({ kind: "SCORE", at: null, text: `Score d'engagement mesuré : ${input.score.score}/100 (${tier})`, hashed: false });
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
