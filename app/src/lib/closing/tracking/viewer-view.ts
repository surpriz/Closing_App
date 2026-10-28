import { cookies, headers } from "next/headers";

import { prisma } from "@/lib/db";

import { VIEW_SESSION_WINDOW_MS } from "../constants";
import { getRequestContext } from "./request-context";
import { VISITOR_COOKIE } from "./visitor";

/**
 * A view opened at page load waits for a first gesture before it counts (track/start). A
 * click that reaches the server is one, and may get here before the confirming call does:
 * it confirms the view itself. Bots by their user agent and the seller stay excluded.
 */
export async function confirmAwaitingView<T extends { id: string; isBot: boolean; fromSeller: boolean }>(
  view: T | null,
): Promise<T | null> {
  if (!view || !view.isBot || view.fromSeller) return view;
  if (getRequestContext(await headers()).isBot) return view;
  await prisma.documentView.update({ where: { id: view.id }, data: { isBot: false, lastSeenAt: new Date() } });
  return { ...view, isBot: false };
}

/**
 * The reading session a prospect request belongs to: the tracked view of this
 * browser, or its latest one when the view id is not known yet. Null when the
 * browser has no visitor cookie or no recent view on this link.
 */
export async function resolveViewerView(linkId: string, viewId: string | null | undefined, now = new Date()) {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!visitorId) return null;

  const select = { id: true, visitorId: true, ipHash: true, isBot: true, fromSeller: true, email: true } as const;
  return confirmAwaitingView(
    (viewId && (await prisma.documentView.findFirst({ where: { id: viewId, linkId, visitorId }, select }))) ||
      (await prisma.documentView.findFirst({
        where: { linkId, visitorId, lastSeenAt: { gte: new Date(now.getTime() - VIEW_SESSION_WINDOW_MS) } },
        orderBy: { lastSeenAt: "desc" },
        select,
      })),
  );
}

/** Crawlers may not write anything. Seller views are flagged isBot too, but the seller may test their link. */
export function isCrawlerView(view: { isBot: boolean; fromSeller: boolean }) {
  return view.isBot && !view.fromSeller;
}
