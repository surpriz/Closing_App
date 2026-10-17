import type { UiLocale } from "@/i18n/locale";
import { getNamespaceTranslator } from "@/lib/server-translator";

import type { Person, ReaderMap, ReaderOrigin } from "./reader-map";
import { isDecisionRole } from "./roles";

/**
 * What the reader map says when a session starts. Pure; `reason` is written in the seller's language.
 *
 * - COMMITTEE_LIVE: enough people read at the same time, a decision meeting.
 * - DECISION_MAKER_DETECTED: finance or an executive reads, and it is not a
 *   recipient the seller already talks to.
 * - NEW_READER: someone other than the recipient opened the proposal.
 *
 * Only one alert is pushed per session start (pickReaderAlert); the others are
 * stored silently so they show in the timeline and never fire later.
 */

export type ReaderAlertType = "COMMITTEE_LIVE" | "DECISION_MAKER_DETECTED" | "NEW_READER";

export type ReaderAlert = {
  type: ReaderAlertType;
  dedupeKey: string;
  reason: string;
  personKey: string | null;
  readerName?: string;
  readerOrigin?: ReaderOrigin;
  readerDomain?: string;
  liveViewers?: number;
  decisionMakers?: string[];
};

/** At most one committee alert per link in this window. */
export const COMMITTEE_WINDOW_MS = 2 * 60 * 60 * 1000;

export const committeeKey = (linkId: string, now: Date) => `committee:${linkId}:${Math.floor(now.getTime() / COMMITTEE_WINDOW_MS)}`;
export const newReaderKey = (linkId: string, personKey: string) => `new_reader:${linkId}:${personKey}`;
export const decisionMakerKey = (linkId: string, prospectId: string) => `decision_maker:${linkId}:${prospectId}`;

const ownerOf = (map: ReaderMap, viewId: string) => map.persons.find((p) => p.viewIds.includes(viewId)) ?? null;

const readersT = (locale: UiLocale) => getNamespaceTranslator(locale, "alerts.readers");

function roleText(person: Person, locale: UiLocale) {
  if (!person.role) return "";
  const role = getNamespaceTranslator(locale, "labels")(`prospectRole.${person.role.role}`);
  return readersT(locale)(person.role.source === "seller" ? "roleTagged" : "roleDetected", { role });
}

export function detectCommittee(
  map: ReaderMap,
  linkId: string,
  threshold: number,
  now: Date,
  locale: UiLocale,
): ReaderAlert | null {
  const t = readersT(locale);
  const live = map.persons.filter((p) => p.liveRecent);
  if (live.length < threshold) return null;
  const decisionMakers = live.filter((p) => isDecisionRole(p.role?.role)).map((p) => p.label);
  const among =
    decisionMakers.length === 0
      ? ""
      : decisionMakers.length === 1
        ? t("amongOne")
        : t("amongMany", { count: decisionMakers.length });
  return {
    type: "COMMITTEE_LIVE",
    dedupeKey: committeeKey(linkId, now),
    reason: t("committee", { count: live.length, among }),
    personKey: null,
    liveViewers: live.length,
    decisionMakers,
  };
}

/** Same network and same kind of device as someone already seen: a private window, not a new person. */
function isClone(person: Person, map: ReaderMap) {
  return map.persons.some(
    (other) =>
      other !== person &&
      other.firstReadAt <= person.firstReadAt &&
      other.ipHashes.some((ip) => person.ipHashes.includes(ip)) &&
      other.deviceSignatures.some((s) => person.deviceSignatures.includes(s)),
  );
}

export function detectNewReader(map: ReaderMap, linkId: string, viewId: string, locale: UiLocale): ReaderAlert | null {
  const t = readersT(locale);
  const person = ownerOf(map, viewId);
  if (!person || person.origin === "initial" || map.persons.length < 2) return null;

  let reason: string;
  if (person.origin === "forwarded_internal") reason = t("forwardedInternal", { name: person.label });
  else if (person.origin === "external") {
    reason = t("external", { name: person.label, domain: person.domain ? ` (${person.domain})` : "" });
  }
  else {
    // Without a network we cannot tell a new person from a cleared cookie
    if (person.ipHashes.length === 0 || isClone(person, map)) return null;
    reason = t("probableNew");
  }

  return {
    type: "NEW_READER",
    dedupeKey: newReaderKey(linkId, person.key),
    reason,
    personKey: person.key,
    readerName: person.label,
    readerOrigin: person.origin,
    readerDomain: person.domain ?? undefined,
  };
}

export function detectDecisionMaker(map: ReaderMap, linkId: string, viewId: string, locale: UiLocale): ReaderAlert | null {
  const t = readersT(locale);
  const person = ownerOf(map, viewId);
  if (!person?.prospectId || !isDecisionRole(person.role?.role)) return null;
  // The seller already talks to the recipients: only someone the proposal reached matters
  if (person.origin === "initial") return null;

  const forwarded = person.origin === "forwarded_internal" ? t("forwarded") : "";
  return {
    type: "DECISION_MAKER_DETECTED",
    dedupeKey: decisionMakerKey(linkId, person.prospectId),
    reason: t("decisionMaker", { name: person.label, role: roleText(person, locale), forwarded }),
    personKey: person.key,
    readerName: person.label,
    readerOrigin: person.origin,
    readerDomain: person.domain ?? undefined,
  };
}

const RANK: Record<ReaderAlertType, number> = { DECISION_MAKER_DETECTED: 0, COMMITTEE_LIVE: 1, NEW_READER: 2 };

/** The one alert to push now, and the ones to store silently. */
export function pickReaderAlert(
  candidates: ReaderAlert[],
  locale: UiLocale,
): { notify: ReaderAlert | null; silent: ReaderAlert[] } {
  const sorted = [...candidates].sort((a, b) => RANK[a.type] - RANK[b.type]);
  const [winner, ...rest] = sorted;
  if (!winner) return { notify: null, silent: [] };

  const committee = rest.find((a) => a.type === "COMMITTEE_LIVE");
  const notify =
    winner.type === "DECISION_MAKER_DETECTED" && committee
      ? {
          ...winner,
          reason: readersT(locale)("withOthers", { reason: winner.reason, count: committee.liveViewers! - 1 }),
          liveViewers: committee.liveViewers,
        }
      : winner;
  return { notify, silent: rest };
}
