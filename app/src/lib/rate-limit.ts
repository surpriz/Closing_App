import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { reportSecurityEvent } from "@/lib/security-events";

export type Limit = { max: number; windowSeconds: number };

// About ten times what a real reader or seller does: only a script ever gets there.
// Viewer limits count per IP *and* link (see perLink): a whole company behind one IP,
// each person on their own link, never adds up
export const LIMITS = {
  gate: { max: 30, windowSeconds: 10 * 60 },
  // One Smart Link for a whole campaign: colleagues share it and the IP. The per-link
  // cap of the route (readers per hour) is the real guard
  smart: { max: 60, windowSeconds: 10 * 60 },
  // Two calls per human reader: the opening at load, then its confirmation at the first gesture
  trackStart: { max: 240, windowSeconds: 10 * 60 },
  trackGate: { max: 120, windowSeconds: 10 * 60 },
  forward: { max: 20, windowSeconds: 60 * 60 },
  // Per seller
  upload: { max: 60, windowSeconds: 60 * 60 },
  pairClaim: { max: 10, windowSeconds: 10 * 60 },
  // Per IP: the add-in asks for a code before anyone is signed in
  pairCreate: { max: 20, windowSeconds: 10 * 60 },
  // Per address, report only: sign-in links asked for one inbox from many IPs
  magicLinkEmail: { max: 10, windowSeconds: 60 * 60 },
  // Per seller: each attempt opens IMAP and SMTP sessions to a host the seller typed
  mailboxConnect: { max: 5, windowSeconds: 60 * 60 },
  // Per seller: the stop list export reads every row of the workspace
  suppressionExport: { max: 10, windowSeconds: 60 * 60 },
  // Per workspace: a cold email tool reporting replies, unsubscribes and bounces of a whole campaign
  sequencer: { max: 600, windowSeconds: 10 * 60 },
} satisfies Record<string, Limit>;

export type LimitScope = keyof typeof LIMITS;

/** Vercel sets x-real-ip itself; x-forwarded-for is the fallback outside Vercel. */
export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Viewer limits: this IP on this link. */
export function perLink(headers: Headers, link: string) {
  return `${clientIp(headers) ?? "unknown"}:${link}`;
}

/** The subject is hashed: no raw IP ends up in the table. */
export function limitKey(scope: string, subject: string) {
  return `${scope}:${createHash("sha256").update(subject).digest("hex").slice(0, 32)}`;
}

/**
 * Counts one hit for this scope and subject (default: the client IP) and says whether it is
 * still within the limit. A database error lets the request through: a limiter outage must not
 * take the viewer down with it.
 */
export async function consumeLimit(scope: LimitScope, headers: Headers, subject = clientIp(headers) ?? "unknown") {
  const { max, windowSeconds } = LIMITS[scope];
  const key = limitKey(scope, subject);
  const now = new Date();
  const expired = new Date(now.getTime() - windowSeconds * 1000);
  try {
    const rows = await prisma.$queryRaw<{ count: number }[]>`
      INSERT INTO request_limits (key, count, "windowStart") VALUES (${key}, 1, ${now})
      ON CONFLICT (key) DO UPDATE SET
        count = CASE WHEN request_limits."windowStart" <= ${expired} THEN 1 ELSE request_limits.count + 1 END,
        "windowStart" = CASE WHEN request_limits."windowStart" <= ${expired} THEN ${now} ELSE request_limits."windowStart" END
      RETURNING count`;
    const count = rows[0]?.count ?? 0;
    // Told once per window, on the first request refused
    if (count === max + 1) reportSecurityEvent("rate_limit_crossed", { scope, max, windowSeconds });
    return count <= max;
  } catch (error) {
    console.error("[rate-limit] check failed, request let through", error);
    return true;
  }
}

export function tooManyRequests() {
  return NextResponse.json({ error: "too_many_requests" }, { status: 429 });
}

/** Windows are an hour at most: anything older is dead weight. */
export async function purgeRequestLimits(now: Date) {
  const { count } = await prisma.requestLimit.deleteMany({
    where: { windowStart: { lt: new Date(now.getTime() - 2 * 60 * 60 * 1000) } },
  });
  return count;
}
