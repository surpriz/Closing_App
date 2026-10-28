import type { PageTag } from "@/generated/prisma/enums";
import { DAY_MS } from "@/lib/closing/constants";
import type { LinkReading } from "@/lib/closing/shared/reading-time";

export type EnrollmentSignals = {
  opened: boolean;
  readingMs: number;
  pricingMs: number;
  sessions: number;
  deepRead: boolean;
  lastReadAt: Date | null;
  readTags: PageTag[];
  forwardedTo: string[];
  replied: boolean;
  lastSentAt: Date | null;
  sentLast30: number;
  lastSignal: string | null;
  reactivatedAt: Date | null;
  openFollowup: boolean;
};

/** Everything the planner needs about one enrollment's reading, gathered by the caller. Pure. */
export function signalsFrom(input: {
  reading: LinkReading;
  views: { startedAt: Date; lastSeenAt: Date; isBot: boolean }[];
  deepRead: boolean;
  forwards: { toEmail: string }[];
  enrollment: { repliedAt: Date | null; lastSignal: string | null; reactivatedAt: Date | null };
  sent: { sentAt: Date; kind: "STEP" | "FOLLOWUP" }[];
  openFollowup: boolean;
  now: Date;
}): EnrollmentSignals {
  const { reading, enrollment, now } = input;
  const humanViews = input.views.filter((view) => !view.isBot);
  const lastReadAt = humanViews.reduce<Date | null>(
    (latest, view) => (!latest || view.lastSeenAt > latest ? view.lastSeenAt : latest),
    null,
  );
  const lastSentAt = input.sent.reduce<Date | null>(
    (latest, message) => (!latest || message.sentAt > latest ? message.sentAt : latest),
    null,
  );
  const since = now.getTime() - 30 * DAY_MS;

  return {
    opened: humanViews.length > 0,
    readingMs: reading.readingMs,
    pricingMs: reading.pricingMs,
    sessions: humanViews.length,
    deepRead: input.deepRead,
    lastReadAt,
    readTags: reading.tags,
    forwardedTo: [...new Set(input.forwards.map((forward) => forward.toEmail.trim().toLowerCase()))],
    replied: enrollment.repliedAt !== null,
    lastSentAt,
    sentLast30: input.sent.filter((message) => message.sentAt.getTime() >= since).length,
    lastSignal: enrollment.lastSignal,
    reactivatedAt: enrollment.reactivatedAt,
    openFollowup: input.openFollowup,
  };
}
