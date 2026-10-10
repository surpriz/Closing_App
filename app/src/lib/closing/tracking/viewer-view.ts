import { cookies } from "next/headers";

import { prisma } from "@/lib/db";

import { VIEW_SESSION_WINDOW_MS } from "../constants";
import { VISITOR_COOKIE } from "./visitor";

/**
 * The reading session a prospect request belongs to: the tracked view of this
 * browser, or its latest one when the view id is not known yet. Null when the
 * browser has no visitor cookie or no recent view on this link.
 */
export async function resolveViewerView(linkId: string, viewId: string | null | undefined, now = new Date()) {
  const visitorId = (await cookies()).get(VISITOR_COOKIE)?.value;
  if (!visitorId) return null;

  const select = { id: true, visitorId: true, ipHash: true, isBot: true, fromSeller: true, email: true } as const;
  return (
    (viewId && (await prisma.documentView.findFirst({ where: { id: viewId, linkId, visitorId }, select }))) ||
    (await prisma.documentView.findFirst({
      where: { linkId, visitorId, lastSeenAt: { gte: new Date(now.getTime() - VIEW_SESSION_WINDOW_MS) } },
      orderBy: { lastSeenAt: "desc" },
      select,
    }))
  );
}

/** Crawlers may not write anything. Seller views are flagged isBot too, but the seller may test their link. */
export function isCrawlerView(view: { isBot: boolean; fromSeller: boolean }) {
  return view.isBot && !view.fromSeller;
}
