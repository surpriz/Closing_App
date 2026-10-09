import type { ProspectOrigin, ProspectRole } from "@/generated/prisma/enums";

import { LIVE_VIEW_WINDOW_MS } from "../constants";
import { labelReaders } from "../dashboard/readers";
import { isPersonalEmail } from "../prospects/from-recipient";
import { isReadingNow } from "../tracking/live-status";
import { classifyRole, effectiveRole, type EffectiveRole } from "./roles";

/**
 * Who reads a proposal, as people grouped by company. Pure.
 *
 * Sessions become people: a known contact, else a typed email, else a browser.
 * A browser that ever gave an email folds into that contact, so one person on
 * two devices with the same email counts once. Anonymous browsers are never
 * merged with each other: a company fleet has identical laptops behind one IP,
 * and merging them would hide the committee.
 *
 * People are grouped by email domain. Anonymous readers and personal mailboxes
 * on the same network (ipHash) as a known company join it: probably a
 * colleague the proposal was passed to.
 */

export type ReaderView = {
  id: string;
  linkId: string;
  visitorId: string;
  prospectId: string | null;
  email: string | null;
  ipHash: string | null;
  deviceType: string | null;
  browser: string | null;
  os: string | null;
  startedAt: Date;
  lastSeenAt: Date;
  leftAt: Date | null;
  totalDurationMs: number;
};

export type ReaderProspect = {
  id: string;
  email: string;
  name: string | null;
  role: ProspectRole | null;
  origin: ProspectOrigin;
  createdAt: Date;
};

export type ReaderOrigin = "initial" | "forwarded_internal" | "external" | "anonymous";

export type Person = {
  key: string;
  prospectId: string | null;
  email: string | null;
  label: string;
  identified: boolean;
  role: EffectiveRole | null;
  /** What the email and name suggest, whatever the seller tagged. */
  detectedRole: ProspectRole | null;
  origin: ReaderOrigin;
  /** Company domain, null for personal mailboxes and anonymous readers. */
  domain: string | null;
  /** Joined a company group through its network, not its email. */
  viaNetwork: boolean;
  viewIds: string[];
  ipHashes: string[];
  deviceSignatures: string[];
  firstReadAt: Date;
  lastReadAt: Date;
  totalDurationMs: number;
  /** A flush arrived seconds ago: the dot in the UI. */
  readingNow: boolean;
  /** Seen within the hot-lead window: counts toward a committee. */
  liveRecent: boolean;
};

export type ReaderGroup = {
  key: string;
  kind: "domain" | "network" | "personal" | "unknown";
  label: string;
  persons: Person[];
};

export type ReaderMap = {
  persons: Person[];
  groups: ReaderGroup[];
};

export function emailDomain(email: string | null) {
  if (!email || isPersonalEmail(email)) return null;
  return email.split("@")[1]?.toLowerCase() ?? null;
}

export function deviceSignature(view: Pick<ReaderView, "deviceType" | "os" | "browser">) {
  return `${view.deviceType ?? "?"}|${view.os ?? "?"}|${view.browser ?? "?"}`;
}

const byTime = (a: Date, b: Date) => a.getTime() - b.getTime();

function personKeys(views: ReaderView[], prospectsByEmail: Map<string, ReaderProspect>) {
  const identity = (v: ReaderView) => {
    if (v.prospectId) return `p:${v.prospectId}`;
    if (!v.email) return null;
    const email = v.email.toLowerCase();
    const prospect = prospectsByEmail.get(email);
    return prospect ? `p:${prospect.id}` : `e:${email}`;
  };
  // A browser takes the first identity it ever gave
  const byVisitor = new Map<string, string>();
  for (const v of [...views].sort((a, b) => byTime(a.startedAt, b.startedAt))) {
    const id = identity(v);
    if (id && !byVisitor.has(v.visitorId)) byVisitor.set(v.visitorId, id);
  }
  return (v: ReaderView) => identity(v) ?? byVisitor.get(v.visitorId) ?? `v:${v.visitorId}`;
}

export function buildReaderMap(input: { views: ReaderView[]; prospects: ReaderProspect[]; now: Date }): ReaderMap {
  const { prospects, now } = input;
  const views = [...input.views].sort((a, b) => byTime(a.startedAt, b.startedAt));
  const prospectsById = new Map(prospects.map((p) => [p.id, p]));
  const prospectsByEmail = new Map(prospects.map((p) => [p.email.toLowerCase(), p]));
  const keyOf = personKeys(views, prospectsByEmail);

  const sellerProspects = prospects.filter((p) => p.origin === "SELLER");
  const originalDomains = new Set(sellerProspects.map((p) => emailDomain(p.email)).filter((d): d is string => !!d));

  const labels = labelReaders(
    views.map((v) => {
      const p = v.prospectId ? prospectsById.get(v.prospectId) : undefined;
      return { ...v, prospect: p ? { name: p.name, email: p.email } : null };
    }),
  );

  const persons = new Map<string, Person>();
  for (const v of views) {
    const key = keyOf(v);
    let person = persons.get(key);
    if (!person) {
      const prospect = key.startsWith("p:") ? prospectsById.get(key.slice(2)) : undefined;
      const email = prospect?.email ?? (key.startsWith("e:") ? key.slice(2) : null);
      person = {
        key,
        prospectId: prospect?.id ?? null,
        email,
        label: prospect ? (prospect.name ?? prospect.email) : (email ?? labels.get(v.id)?.name ?? "Lecteur non identifié"),
        identified: !!email,
        role: prospect ? effectiveRole(prospect) : email ? effectiveRole({ role: null, email, name: null }) : null,
        detectedRole: email ? classifyRole({ email, name: prospect?.name ?? null }) : null,
        origin: !email ? "anonymous" : prospect?.origin === "SELLER" ? "initial" : "external",
        domain: emailDomain(email),
        viaNetwork: false,
        viewIds: [],
        ipHashes: [],
        deviceSignatures: [],
        firstReadAt: v.startedAt,
        lastReadAt: v.lastSeenAt,
        totalDurationMs: 0,
        readingNow: false,
        liveRecent: false,
      };
      persons.set(key, person);
    }
    person.viewIds.push(v.id);
    if (v.ipHash && !person.ipHashes.includes(v.ipHash)) person.ipHashes.push(v.ipHash);
    const sig = deviceSignature(v);
    if (!person.deviceSignatures.includes(sig)) person.deviceSignatures.push(sig);
    if (v.lastSeenAt > person.lastReadAt) person.lastReadAt = v.lastSeenAt;
    person.totalDurationMs += v.totalDurationMs;
    person.readingNow ||= isReadingNow(v, now);
    person.liveRecent ||= now.getTime() - v.lastSeenAt.getTime() <= LIVE_VIEW_WINDOW_MS;
  }

  const list = [...persons.values()];
  // Nobody the seller added has read yet: the first reader is the recipient
  if (!list.some((p) => p.origin === "initial") && list.length > 0) list[0].origin = "initial";
  // No contact from the seller: the recipient's company is the one that read first
  if (originalDomains.size === 0) for (const p of list) if (p.origin === "initial" && p.domain) originalDomains.add(p.domain);
  for (const p of list) if (p.origin === "external" && p.domain && originalDomains.has(p.domain)) p.origin = "forwarded_internal";

  return { persons: list, groups: groupPersons(list) };
}

function groupPersons(persons: Person[]): ReaderGroup[] {
  const groups = new Map<string, ReaderGroup>();
  const add = (key: string, make: () => Omit<ReaderGroup, "persons">, person: Person) => {
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { ...make(), persons: [] }));
    group.persons.push(person);
  };

  const domainByIp = new Map<string, string>();
  for (const p of persons) {
    if (!p.domain) continue;
    add(`domain:${p.domain}`, () => ({ key: `domain:${p.domain}`, kind: "domain", label: p.domain! }), p);
    for (const ip of p.ipHashes) if (!domainByIp.has(ip)) domainByIp.set(ip, p.domain);
  }

  let networks = 0;
  for (const p of persons) {
    if (p.domain) continue;
    const domain = p.ipHashes.map((ip) => domainByIp.get(ip)).find(Boolean);
    if (domain) {
      p.viaNetwork = true;
      add(`domain:${domain}`, () => ({ key: `domain:${domain}`, kind: "domain", label: domain }), p);
    } else if (p.ipHashes.length > 0) {
      const existing = p.ipHashes.map((ip) => `net:${ip}`).find((k) => groups.has(k));
      const key = existing ?? `net:${p.ipHashes[0]}`;
      add(key, () => ({ key, kind: "network", label: `Réseau non identifié ${++networks}` }), p);
    } else if (p.email) {
      add("personal", () => ({ key: "personal", kind: "personal", label: "Adresses personnelles" }), p);
    } else {
      add("unknown", () => ({ key: "unknown", kind: "unknown", label: "Réseau inconnu" }), p);
    }
  }

  const rank = (g: ReaderGroup) => (g.persons.some((p) => p.origin === "initial") ? 0 : 1);
  const first = (g: ReaderGroup) => Math.min(...g.persons.map((p) => p.firstReadAt.getTime()));
  return [...groups.values()].sort((a, b) => rank(a) - rank(b) || first(a) - first(b));
}
