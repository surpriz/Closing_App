import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export type Limit = { max: number; windowSeconds: number };

// Per client IP. Far above what a real reader or seller does, low enough to stop a script
export const LIMITS = {
  gate: { max: 10, windowSeconds: 10 * 60 },
  smart: { max: 30, windowSeconds: 10 * 60 },
  trackStart: { max: 120, windowSeconds: 10 * 60 },
  trackGate: { max: 120, windowSeconds: 10 * 60 },
  upload: { max: 60, windowSeconds: 60 * 60 },
  pairCreate: { max: 20, windowSeconds: 10 * 60 },
  pairClaim: { max: 10, windowSeconds: 10 * 60 },
  forward: { max: 10, windowSeconds: 60 * 60 },
} satisfies Record<string, Limit>;

export type LimitScope = keyof typeof LIMITS;

/** Vercel sets x-real-ip itself; x-forwarded-for is the fallback outside Vercel. */
export function clientIp(headers: Headers) {
  return headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
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
    return (rows[0]?.count ?? 0) <= max;
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
