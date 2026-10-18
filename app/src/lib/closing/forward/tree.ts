import type { ProspectActionType, ProspectOrigin } from "@/generated/prisma/enums";

import type { Person } from "../committee/reader-map";
import type { EffectiveRole } from "../committee/roles";
import { isDecisionRole } from "../committee/roles";
import { readerName } from "./names";

/**
 * The "Circuit du document": who passed the proposal to whom, and what each
 * person did with it. Pure.
 *
 * Roots are the contacts the seller added (or who came from a cold email or
 * prospecting). People who typed their email at the gate without a known
 * forwarder arrived "hors Clozer": a forward from a mail client. Under each
 * person, the people they forwarded it to with "Transférer".
 */

export type ForwardAction = "signed" | "change" | "quote" | "voice" | "meeting" | "extension" | "relink";

/** What a prospect action says on a node; opening the booking page says nothing yet. */
export const FORWARD_ACTION: Partial<Record<ProspectActionType, ForwardAction>> = {
  VALIDATE_SIGN: "signed",
  REQUEST_CHANGE: "change",
  REQUEST_QUOTE: "quote",
  MEETING_BOOKED: "meeting",
  REQUEST_EXTENSION: "extension",
  REQUEST_RELINK: "relink",
};

/** Each person's actions, once each, in the order they happened. */
export function actionsByProspect(rows: { prospectId: string | null; action: ForwardAction | undefined; at: Date }[]) {
  const map = new Map<string, ForwardAction[]>();
  for (const row of [...rows].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (!row.prospectId || !row.action) continue;
    const list = map.get(row.prospectId) ?? [];
    if (!list.includes(row.action)) list.push(row.action);
    map.set(row.prospectId, list);
  }
  return map;
}

export type ForwardNode = {
  prospectId: string;
  label: string;
  email: string;
  origin: ProspectOrigin;
  role: EffectiveRole | null;
  decision: boolean;
  opened: boolean;
  readingNow: boolean;
  views: number;
  readingMs: number;
  firstReadAt: Date | null;
  lastReadAt: Date | null;
  hotPages: number[];
  actions: ForwardAction[];
  /** The latest "Transférer" that reached them. */
  received: { from: string | null; message: string | null; at: Date; delivered: boolean; failed: boolean } | null;
  children: ForwardNode[];
};

export type ForwardTree = {
  roots: ForwardNode[];
  offClozer: ForwardNode[];
  /** Readers who never gave an email. */
  anonymous: number;
  hasForwards: boolean;
};

type TreeProspect = {
  id: string;
  email: string;
  name: string | null;
  origin: ProspectOrigin;
  forwardedById: string | null;
  createdAt: Date;
};

type TreeForward = {
  fromProspectId: string | null;
  toProspectId: string;
  message: string | null;
  createdAt: Date;
  sentAt: Date | null;
  error: string | null;
};

type PageTime = { pageNumber: number; totalDurationMs: number };

/** The pages read longest, at most `max`, ties to the earlier page. */
export function hottestPages(rows: PageTime[], max = 3) {
  return rows
    .filter((row) => row.totalDurationMs > 0)
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs || a.pageNumber - b.pageNumber)
    .slice(0, max)
    .map((row) => row.pageNumber);
}

export function buildForwardTree(input: {
  prospects: TreeProspect[];
  forwards: TreeForward[];
  persons: Person[];
  pagesByProspect: Map<string, PageTime[]>;
  actionsByProspect: Map<string, ForwardAction[]>;
}): ForwardTree {
  const { prospects, forwards } = input;
  const byId = new Map(prospects.map((p) => [p.id, p]));
  const personOf = new Map(input.persons.filter((p) => p.prospectId).map((p) => [p.prospectId!, p]));

  const latestReceived = new Map<string, TreeForward>();
  for (const f of forwards) {
    const current = latestReceived.get(f.toProspectId);
    if (!current || f.createdAt > current.createdAt) latestReceived.set(f.toProspectId, f);
  }

  const childrenOf = new Map<string, TreeProspect[]>();
  for (const p of prospects) {
    if (!p.forwardedById || !byId.has(p.forwardedById)) continue;
    const list = childrenOf.get(p.forwardedById) ?? [];
    list.push(p);
    childrenOf.set(p.forwardedById, list);
  }

  const visited = new Set<string>();
  const node = (p: TreeProspect): ForwardNode => {
    visited.add(p.id);
    const person = personOf.get(p.id);
    const received = latestReceived.get(p.id);
    const from = received?.fromProspectId ? byId.get(received.fromProspectId) : undefined;
    return {
      prospectId: p.id,
      label: readerName(p),
      email: p.email,
      origin: p.origin,
      role: person?.role ?? null,
      decision: isDecisionRole(person?.role?.role),
      opened: !!person,
      readingNow: person?.readingNow ?? false,
      views: person?.viewIds.length ?? 0,
      readingMs: person?.totalDurationMs ?? 0,
      firstReadAt: person?.firstReadAt ?? null,
      lastReadAt: person?.lastReadAt ?? null,
      hotPages: hottestPages(input.pagesByProspect.get(p.id) ?? []),
      actions: input.actionsByProspect.get(p.id) ?? [],
      received: received
        ? {
            from: from ? readerName(from) : null,
            message: received.message,
            at: received.createdAt,
            delivered: !!received.sentAt,
            failed: !received.sentAt && !!received.error,
          }
        : null,
      // Each person shows once, whatever the data says
      children: (childrenOf.get(p.id) ?? [])
        .filter((child) => !visited.has(child.id))
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .map(node),
    };
  };

  const ordered = [...prospects].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const isTop = (p: TreeProspect) => !p.forwardedById || !byId.has(p.forwardedById);
  const roots = ordered.filter((p) => isTop(p) && p.origin !== "EMAIL_GATE").map(node);
  const offClozer = ordered.filter((p) => isTop(p) && p.origin === "EMAIL_GATE" && !visited.has(p.id)).map(node);
  // Caught in a loop of parents (older data, a race): still shown, at the top
  for (const p of ordered) if (!visited.has(p.id)) roots.push(node(p));

  return {
    roots,
    offClozer,
    anonymous: input.persons.filter((p) => !p.prospectId && !p.email).length,
    hasForwards: forwards.length > 0,
  };
}
